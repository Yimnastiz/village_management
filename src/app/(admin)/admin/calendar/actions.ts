"use server";

import { NotificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidateAdminSidebar } from "@/lib/revalidate-admin-sidebar";
import { getAdminMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { notificationMetadata } from "@/lib/notification-copy";

const villageEventSubmission = prisma.villageEventSubmission;

const inputSchema = z.object({
  title: z.string().min(3, "กรุณาระบุชื่อกิจกรรม"),
  description: z.string().optional(),
  location: z.string().optional(),
  startsAt: z.string().min(1, "กรุณาระบุวันเวลาเริ่ม"),
  endsAt: z.string().optional(),
  isPublic: z.string().min(1, "กรุณาเลือกการมองเห็น"),
});

type EventInput = z.infer<typeof inputSchema>;

async function requireAdminVillage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    return { ok: false as const, error: "กรุณาเข้าสู่ระบบ", villageId: "", userId: "" };
  }
  const membership = getAdminMembership(session);
  if (!membership) {
    return { ok: false as const, error: "ไม่พบหมู่บ้านของคุณ", villageId: "", userId: "" };
  }

  return { ok: true as const, error: null, villageId: membership.villageId, userId: session.id };
}

function normalizeInput(data: EventInput) {
  const parsed = inputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง",
    };
  }

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = parsed.data.endsAt?.trim() ? new Date(parsed.data.endsAt) : null;
  if (Number.isNaN(startsAt.getTime())) {
    return { ok: false as const, error: "วันเวลาเริ่มไม่ถูกต้อง" };
  }
  if (endsAt && Number.isNaN(endsAt.getTime())) {
    return { ok: false as const, error: "วันเวลาสิ้นสุดไม่ถูกต้อง" };
  }
  if (endsAt && endsAt < startsAt) {
    return { ok: false as const, error: "วันเวลาสิ้นสุดต้องมากกว่าหรือเท่ากับวันเวลาเริ่ม" };
  }

  const isPublic = parsed.data.isPublic === "PUBLIC";

  return {
    ok: true as const,
    value: {
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      location: parsed.data.location?.trim() || null,
      startsAt,
      endsAt,
      isPublic,
    },
  };
}

export async function createVillageEventAction(
  data: EventInput
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  try {
    const created = await prisma.villageEvent.create({
      data: {
        villageId: ctx.villageId,
        createdById: ctx.userId,
        title: normalized.value.title,
        description: normalized.value.description,
        location: normalized.value.location,
        startsAt: normalized.value.startsAt,
        endsAt: normalized.value.endsAt,
        isPublic: normalized.value.isPublic,
      },
      select: { id: true },
    });

    revalidatePath("/admin/calendar");
    revalidatePath("/resident/calendar");

    return { success: true, id: created.id };
  } catch {
    return { success: false, error: "สร้างกิจกรรมไม่สำเร็จ กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง" };
  }
}

export async function updateVillageEventAction(
  id: string,
  data: EventInput
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const existing = await prisma.villageEvent.findFirst({
    where: { id, villageId: ctx.villageId },
    select: { id: true },
  });
  if (!existing) {
    return { success: false, error: "ไม่พบกิจกรรมนี้หรือไม่มีสิทธิ์แก้ไข" };
  }

  try {
    await prisma.villageEvent.update({
      where: { id },
      data: {
        title: normalized.value.title,
        description: normalized.value.description,
        location: normalized.value.location,
        startsAt: normalized.value.startsAt,
        endsAt: normalized.value.endsAt,
        isPublic: normalized.value.isPublic,
      },
    });

    revalidatePath("/admin/calendar");
    revalidatePath(`/admin/calendar/${id}`);
    revalidatePath("/resident/calendar");

    return { success: true };
  } catch {
    return { success: false, error: "บันทึกกิจกรรมไม่สำเร็จ กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง" };
  }
}

export async function deleteVillageEventAction(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const existing = await prisma.villageEvent.findFirst({
    where: { id, villageId: ctx.villageId },
    select: { id: true },
  });
  if (!existing) {
    return { success: false, error: "ไม่พบกิจกรรมนี้หรือไม่มีสิทธิ์ลบ" };
  }

  try {
    await prisma.villageEvent.delete({ where: { id } });
    revalidatePath("/admin/calendar");
    revalidatePath("/resident/calendar");
    return { success: true };
  } catch {
    return { success: false, error: "ลบกิจกรรมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
}

export async function adminApproveVillageEventSubmissionAction(
  requestId: string,
  reviewNote?: string,
  finalVisibility?: "PUBLIC" | "RESIDENT"
): Promise<{ success: true; eventId: string } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const request = await villageEventSubmission.findFirst({
    where: {
      id: requestId,
      villageId: ctx.villageId,
      status: "PENDING",
    },
  });

  if (!request) {
    return { success: false, error: "ไม่พบคำขอนี้หรือคำขอถูกดำเนินการแล้ว" };
  }
  if (finalVisibility !== "PUBLIC" && finalVisibility !== "RESIDENT") {
    return { success: false, error: "กรุณาเลือกการมองเห็นเมื่อเผยแพร่" };
  }
  const isPublic = finalVisibility === "PUBLIC";

  try {
    const now = new Date();
    const approved = await prisma.$transaction(async (tx) => {
      let eventId = request.eventId ?? "";
      if ((request.type ?? "CREATE") === "CREATE") {
        const event = await tx.villageEvent.create({ data: { villageId: request.villageId, createdById: ctx.userId, title: request.title, description: request.description, location: request.location, startsAt: request.startsAt, endsAt: request.endsAt, isPublic }, select: { id: true } });
        eventId = event.id;
      } else {
        const existingEvent = request.eventId ? await tx.villageEvent.findFirst({ where: { id: request.eventId, villageId: request.villageId }, select: { id: true } }) : null;
        if (!existingEvent) throw new Error("ไม่พบกิจกรรมเป้าหมาย");
        if (request.type === "DELETE") await tx.villageEvent.delete({ where: { id: existingEvent.id } });
        if (request.type === "EDIT") await tx.villageEvent.update({ where: { id: existingEvent.id }, data: { title: request.title, description: request.description, location: request.location, startsAt: request.startsAt, endsAt: request.endsAt, isPublic } });
      }

      await tx.villageEventSubmission.update({
        where: { id: request.id },
        data: {
          status: "APPROVED",
          reviewedBy: ctx.userId,
          reviewedAt: now,
          reviewNote: reviewNote?.trim() || null,
          eventId,
        },
      });

      await tx.notification.create({
        data: {
          userId: request.requesterId,
          villageId: request.villageId,
          type: NotificationType.SYSTEM,
          title: "คำขอเพิ่มกิจกรรมได้รับการอนุมัติ",
          body: `“${request.title}” ถูกเพิ่มในปฏิทินแล้ว`,
          metadata: notificationMetadata("CALENDAR", {
            actionUrl: eventId ? `/resident/calendar/${eventId}` : "/resident/calendar/requests",
            actionLabel: "ดูกิจกรรม",
            requestId: request.id,
            eventId,
            status: "APPROVED",
          }),
        },
      });

      return { id: eventId };
    });

    revalidatePath("/admin/calendar");
    revalidatePath("/resident/calendar");
    revalidatePath("/admin/calendar/requests");
    revalidateAdminSidebar();
    revalidatePath(`/admin/calendar/requests/${requestId}`);
    revalidatePath("/resident/calendar/requests");
    revalidatePath("/resident/notifications");

    return { success: true, eventId: approved.id };
  } catch {
    return { success: false, error: "อนุมัติคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
}

export async function adminRejectVillageEventSubmissionAction(
  requestId: string,
  reviewNote?: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const request = await villageEventSubmission.findFirst({
    where: {
      id: requestId,
      villageId: ctx.villageId,
      status: "PENDING",
    },
  });

  if (!request) {
    return { success: false, error: "ไม่พบคำขอนี้หรือคำขอถูกดำเนินการแล้ว" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.villageEventSubmission.update({
        where: { id: request.id },
        data: {
          status: "REJECTED",
          reviewedBy: ctx.userId,
          reviewedAt: new Date(),
          reviewNote: reviewNote?.trim() || "ไม่ผ่านเงื่อนไขการอนุมัติ",
        },
      });

      await tx.notification.create({
        data: {
          userId: request.requesterId,
          villageId: request.villageId,
          type: NotificationType.SYSTEM,
          title: "คำขอเพิ่มกิจกรรมไม่ได้รับการอนุมัติ",
          body: `คำขอ “${request.title}” ไม่ได้รับการอนุมัติ เหตุผล: ${reviewNote?.trim() || "ไม่ระบุเหตุผล"}`,
          metadata: notificationMetadata("CALENDAR", {
            actionUrl: "/resident/calendar/requests",
            actionLabel: "ดูคำขอของฉัน",
            requestId: request.id,
            status: "REJECTED",
          }),
        },
      });
    });

    revalidatePath("/admin/calendar/requests");
    revalidateAdminSidebar();
    revalidatePath(`/admin/calendar/requests/${requestId}`);
    revalidatePath("/resident/calendar/requests");
    revalidatePath("/resident/notifications");

    return { success: true };
  } catch {
    return { success: false, error: "ปฏิเสธคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
}

export async function updateVillageEventSubmissionAction(
  requestId: string,
  data: EventInput
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const request = await villageEventSubmission.findFirst({
    where: { id: requestId, villageId: ctx.villageId, status: "PENDING" },
  });
  if (!request) {
    return { success: false, error: "แก้ไขได้เฉพาะคำขอที่รอพิจารณาเท่านั้น" };
  }

  try {
    await villageEventSubmission.update({
      where: { id: request.id },
      data: normalized.value,
    });

    revalidatePath("/admin/calendar/requests");
    revalidateAdminSidebar();
    revalidatePath(`/admin/calendar/requests/${requestId}`);
    revalidatePath("/resident/calendar/requests");
    return { success: true };
  } catch {
    return { success: false, error: "แก้ไขคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
}

export async function deleteVillageEventSubmissionAction(
  requestId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const request = await villageEventSubmission.findFirst({
    where: { id: requestId, villageId: ctx.villageId, status: "PENDING" },
  });
  if (!request) {
    return { success: false, error: "ลบได้เฉพาะคำขอที่รอพิจารณาเท่านั้น เพื่อป้องกันข้อมูลกิจกรรมไม่สอดคล้องกัน" };
  }

  try {
    await villageEventSubmission.delete({ where: { id: request.id } });
    revalidatePath("/admin/calendar/requests");
    revalidateAdminSidebar();
    revalidatePath(`/admin/calendar/requests/${requestId}`);
    revalidatePath("/resident/calendar/requests");
    return { success: true };
  } catch {
    return { success: false, error: "ไม่สามารถลบคำขอได้ กรุณาลองใหม่อีกครั้ง" };
  }
}

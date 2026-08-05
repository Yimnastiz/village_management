"use server";

import { NotificationType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminMembership, getSessionContextFromServerCookies } from "@/lib/access-control";

type EventSubmissionRecord = {
  id: string;
  villageId: string;
  requesterId: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date | null;
  isPublic: boolean;
  status: string;
};

type VillageEventSubmissionDelegate = {
  findFirst(args: unknown): Promise<EventSubmissionRecord | null>;
};

type VillageEventSubmissionTransactionDelegate = {
  update(args: unknown): Promise<unknown>;
};

const villageEventSubmission = (
  prisma as unknown as { villageEventSubmission: VillageEventSubmissionDelegate }
).villageEventSubmission;

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
  reviewNote?: string
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

  try {
    const now = new Date();
    const approved = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const event = await tx.villageEvent.create({
        data: {
          villageId: request.villageId,
          title: request.title,
          description: request.description,
          location: request.location,
          startsAt: request.startsAt,
          endsAt: request.endsAt,
          isPublic: request.isPublic,
        },
        select: { id: true },
      });

      const txWithSubmission = tx as Prisma.TransactionClient & {
        villageEventSubmission: VillageEventSubmissionTransactionDelegate;
      };

      await txWithSubmission.villageEventSubmission.update({
        where: { id: request.id },
        data: {
          status: "APPROVED",
          reviewedBy: ctx.userId,
          reviewedAt: now,
          reviewNote: reviewNote?.trim() || null,
        },
      });

      await tx.notification.create({
        data: {
          userId: request.requesterId,
          villageId: request.villageId,
          type: NotificationType.SYSTEM,
          title: "คำขอเพิ่มกิจกรรมได้รับการอนุมัติ",
          body: `กิจกรรม \"${request.title}\" ได้รับการอนุมัติแล้ว`,
          metadata: {
            actionUrl: `/resident/calendar/${event.id}`,
            actionLabel: "ดูกิจกรรม",
            requestId: request.id,
            status: "APPROVED",
          },
        },
      });

      return event;
    });

    revalidatePath("/admin/calendar");
    revalidatePath("/resident/calendar");
    revalidatePath("/admin/calendar/requests");
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
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const txWithSubmission = tx as Prisma.TransactionClient & {
        villageEventSubmission: VillageEventSubmissionTransactionDelegate;
      };

      await txWithSubmission.villageEventSubmission.update({
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
          title: "คำขอเพิ่มกิจกรรมไม่ผ่านการอนุมัติ",
          body: `กิจกรรม \"${request.title}\" ไม่ผ่านการอนุมัติ`,
          metadata: {
            actionUrl: "/resident/calendar/requests",
            actionLabel: "ดูคำขอของฉัน",
            requestId: request.id,
            status: "REJECTED",
          },
        },
      });
    });

    revalidatePath("/admin/calendar/requests");
    revalidatePath(`/admin/calendar/requests/${requestId}`);
    revalidatePath("/resident/calendar/requests");
    revalidatePath("/resident/notifications");

    return { success: true };
  } catch {
    return { success: false, error: "ปฏิเสธคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
}

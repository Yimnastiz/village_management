"use server";

import { NotificationType, VillageMembershipRole, VillageEventSubmissionType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { resolveApprovedSubmissionEvent } from "@/lib/calendar-submission-event";
import { prisma } from "@/lib/prisma";
import { revalidateAdminSidebar } from "@/lib/revalidate-admin-sidebar";
import { notificationMetadata } from "@/lib/notification-copy";

const requestSchema = z.object({
  title: z.string().min(3, "กรุณาระบุชื่อกิจกรรม"),
  description: z.string().optional(),
  location: z.string().optional(),
  startsAt: z.string().min(1, "กรุณาระบุวันเวลาเริ่ม"),
  endsAt: z.string().optional(),
  visibility: z.enum(["PUBLIC", "RESIDENT"], { message: "กรุณาเลือกการมองเห็นที่ต้องการ" }),
});

type RequestInput = z.infer<typeof requestSchema>;
const pendingChangeConflictMessage = "มีคำขอเกี่ยวกับกิจกรรมนี้รอการพิจารณาอยู่แล้ว";

function normalizeInput(data: RequestInput) {
  const parsed = requestSchema.safeParse(data);
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

  return {
    ok: true as const,
    value: {
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      location: parsed.data.location?.trim() || null,
      startsAt,
      endsAt,
      isPublic: parsed.data.visibility === "PUBLIC",
    },
  };
}

export async function createVillageEventSubmissionAction(
  data: RequestInput
): Promise<{ success: true; requestId: string } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    return { success: false, error: "กรุณาเข้าสู่ระบบ" };
  }

  const membership = getResidentMembership(session);
  if (!membership) {
    return { success: false, error: "ไม่พบหมู่บ้านของคุณ" };
  }

  const normalized = normalizeInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  try {
    const created = await prisma.villageEventSubmission.create({
      data: {
        villageId: membership.villageId,
        requesterId: session.id,
        title: normalized.value.title,
        description: normalized.value.description,
        location: normalized.value.location,
        startsAt: normalized.value.startsAt,
        endsAt: normalized.value.endsAt,
        isPublic: normalized.value.isPublic,
      },
      select: { id: true },
    });

    const admins = await prisma.villageMembership.findMany({
      where: {
        villageId: membership.villageId,
        status: "ACTIVE",
        role: {
          in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN],
        },
      },
      distinct: ["userId"],
      select: { userId: true },
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.userId,
          villageId: membership.villageId,
          type: NotificationType.SYSTEM,
          title: "มีคำขอเพิ่มกิจกรรมใหม่",
          body: `${session.name} ขอเพิ่มกิจกรรม \"${normalized.value.title}\"`,
          metadata: notificationMetadata("CALENDAR", {
            actionUrl: `/admin/calendar/requests/${created.id}`,
            actionLabel: "ตรวจสอบคำขอ",
            requestId: created.id,
          }),
        })),
      });
    }

    revalidatePath("/resident/calendar");
    revalidatePath("/resident/calendar/requests");
    revalidatePath("/admin/calendar/requests");
    revalidateAdminSidebar();
    revalidatePath("/admin/notifications");

    return { success: true, requestId: created.id };
  } catch {
    return { success: false, error: "ส่งคำขอไม่สำเร็จ กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง" };
  }
}

async function residentRequestContext(requestId: string) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { ok: false as const, error: "กรุณาเข้าสู่ระบบ" };
  const membership = getResidentMembership(session);
  if (!membership) return { ok: false as const, error: "ไม่พบสิทธิ์ลูกบ้าน" };
  const request = await prisma.villageEventSubmission.findFirst({ where: { id: requestId, requesterId: session.id, villageId: membership.villageId }, select: { id: true, status: true } });
  if (!request) return { ok: false as const, error: "ไม่พบคำขอหรือคุณไม่มีสิทธิ์ดำเนินการ" };
  if (request.status !== "PENDING") return { ok: false as const, error: "แก้ไขหรือลบได้เฉพาะคำขอที่รอพิจารณา" };
  return { ok: true as const, request };
}

export async function updateResidentVillageEventSubmissionAction(requestId: string, data: RequestInput): Promise<{ success: true; requestId: string } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบ" };
  const membership = getResidentMembership(session);
  if (!membership) return { success: false, error: "ไม่พบสิทธิ์ลูกบ้าน" };
  const source = await prisma.villageEventSubmission.findFirst({
    where: { id: requestId, requesterId: session.id, villageId: membership.villageId, type: VillageEventSubmissionType.CREATE, status: { in: ["PENDING", "APPROVED"] } },
    select: { id: true, status: true, eventId: true, villageId: true, title: true, description: true, location: true, startsAt: true, endsAt: true, isPublic: true },
  });
  if (!source) return { success: false, error: "ไม่พบคำขอหรือคุณไม่มีสิทธิ์ดำเนินการ" };
  const normalized = normalizeInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };
  try {
    if (source.status === "PENDING") {
      await prisma.villageEventSubmission.update({ where: { id: source.id }, data: normalized.value });
      revalidatePath("/resident/calendar"); revalidatePath("/resident/calendar/requests"); revalidatePath(`/resident/calendar/requests/${requestId}`); revalidatePath("/admin/calendar/requests"); revalidateAdminSidebar();
      return { success: true, requestId: source.id };
    } else {
      const event = await resolveApprovedSubmissionEvent(source);
      if (!event) return { success: false, error: "ไม่พบกิจกรรมที่ต้องการแก้ไข กรุณาติดต่อผู้ใหญ่บ้าน" };
      const created = await prisma.$transaction(async (tx) => {
        const duplicate = await tx.villageEventSubmission.findFirst({ where: { villageId: membership.villageId, requesterId: session.id, eventId: event.id, type: { in: [VillageEventSubmissionType.EDIT, VillageEventSubmissionType.DELETE] }, status: "PENDING" }, select: { id: true } });
        if (duplicate) return null;
        await tx.villageEventSubmission.update({ where: { id: source.id }, data: { eventId: event.id } });
        return tx.villageEventSubmission.create({ data: { villageId: membership.villageId, requesterId: session.id, eventId: event.id, type: VillageEventSubmissionType.EDIT, ...normalized.value }, select: { id: true } });
      }, { isolationLevel: "Serializable" });
      if (!created) return { success: false, error: pendingChangeConflictMessage };
      const admins = await prisma.villageMembership.findMany({
        where: { villageId: membership.villageId, status: "ACTIVE", role: { in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN] } },
        distinct: ["userId"],
        select: { userId: true },
      });
      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.userId,
            villageId: membership.villageId,
            type: NotificationType.SYSTEM,
            title: "มีคำขอแก้ไขกิจกรรมใหม่",
            body: `${session.name} ขอแก้ไขกิจกรรม \"${normalized.value.title}\"`,
            metadata: notificationMetadata("CALENDAR", { actionUrl: `/admin/calendar/requests/${created.id}`, actionLabel: "ตรวจสอบคำขอ", requestId: created.id, eventId: event.id }),
          })),
        });
      }
      revalidatePath("/admin/notifications");
      revalidatePath("/resident/calendar"); revalidatePath("/resident/calendar/requests"); revalidatePath(`/resident/calendar/requests/${requestId}`); revalidatePath("/admin/calendar/requests"); revalidateAdminSidebar();
      return { success: true, requestId: created.id };
    }
  } catch { return { success: false, error: "บันทึกคำขอไม่สำเร็จ" }; }
}

export async function deleteResidentVillageEventSubmissionAction(requestId: string): Promise<{ success: true } | { success: false; error: string }> {
  const context = await residentRequestContext(requestId);
  if (!context.ok) return { success: false, error: context.error };
  try {
    await prisma.villageEventSubmission.delete({ where: { id: context.request.id } });
    revalidatePath("/resident/calendar"); revalidatePath("/resident/calendar/requests"); revalidatePath("/admin/calendar/requests"); revalidateAdminSidebar();
    return { success: true };
  } catch { return { success: false, error: "ลบคำขอไม่สำเร็จ" }; }
}

export async function createResidentEventChangeRequestAction(requestId: string, action: "EDIT" | "DELETE", reason: string): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบ" };
  const membership = getResidentMembership(session);
  if (!membership) return { success: false, error: "ไม่พบสิทธิ์ลูกบ้าน" };
  const source = await prisma.villageEventSubmission.findFirst({ where: { id: requestId, requesterId: session.id, villageId: membership.villageId, status: "APPROVED", type: VillageEventSubmissionType.CREATE }, select: { id: true, villageId: true, eventId: true, title: true, description: true, location: true, startsAt: true, endsAt: true, isPublic: true } });
  if (!source) return { success: false, error: "ไม่พบคำขอหรือคุณไม่มีสิทธิ์ดำเนินการ" };
  const event = await resolveApprovedSubmissionEvent(source);
  if (!event) return { success: false, error: "ไม่พบกิจกรรมที่เกี่ยวข้องอย่างชัดเจน กรุณาติดต่อผู้ใหญ่บ้าน" };
  const detail = reason.trim();
  if (!detail) return { success: false, error: "กรุณาระบุรายละเอียดหรือเหตุผล" };
  try {
    const created = await prisma.$transaction(async (tx) => {
      const existing = await tx.villageEventSubmission.findFirst({ where: { villageId: membership.villageId, requesterId: session.id, eventId: event.id, type: { in: [VillageEventSubmissionType.EDIT, VillageEventSubmissionType.DELETE] }, status: "PENDING" }, select: { id: true } });
      if (existing) return null;
      await tx.villageEventSubmission.update({ where: { id: source.id }, data: { eventId: event.id } });
      return tx.villageEventSubmission.create({ data: { villageId: membership.villageId, requesterId: session.id, title: event.title, description: detail, location: event.location, startsAt: event.startsAt, endsAt: event.endsAt, isPublic: event.isPublic, type: action === "EDIT" ? VillageEventSubmissionType.EDIT : VillageEventSubmissionType.DELETE, eventId: event.id }, select: { id: true } });
    }, { isolationLevel: "Serializable" });
    if (!created) return { success: false, error: pendingChangeConflictMessage };
    revalidatePath("/resident/calendar"); revalidatePath("/resident/calendar/requests"); revalidatePath(`/resident/calendar/requests/${requestId}`); revalidatePath("/admin/calendar/requests"); revalidateAdminSidebar();
    return { success: true };
  } catch { return { success: false, error: "ส่งคำขอไม่สำเร็จ" }; }
}

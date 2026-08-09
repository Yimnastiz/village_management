"use server";

import { NotificationType, VillageMembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

type VillageEventSubmissionCreateDelegate = {
  create(args: unknown): Promise<{ id: string }>;
  findFirst(args: unknown): Promise<{ id: string; status: string } | null>;
  update(args: unknown): Promise<unknown>;
  delete(args: unknown): Promise<unknown>;
};

const requestSchema = z.object({
  title: z.string().min(3, "กรุณาระบุชื่อกิจกรรม"),
  description: z.string().optional(),
  location: z.string().optional(),
  startsAt: z.string().min(1, "กรุณาระบุวันเวลาเริ่ม"),
  endsAt: z.string().optional(),
  visibility: z.string().min(1, "กรุณาเลือกการมองเห็น"),
});

type RequestInput = z.infer<typeof requestSchema>;

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

  const villageEventSubmission = (
    prisma as unknown as { villageEventSubmission: VillageEventSubmissionCreateDelegate }
  ).villageEventSubmission;

  try {
    const created = await villageEventSubmission.create({
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
          in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN, VillageMembershipRole.COMMITTEE],
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
          metadata: {
            actionUrl: `/admin/calendar/requests/${created.id}`,
            actionLabel: "ตรวจสอบคำขอ",
            requestId: created.id,
          },
        })),
      });
    }

    revalidatePath("/resident/calendar/requests");
    revalidatePath("/admin/calendar/requests");
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
  const delegate = (prisma as unknown as { villageEventSubmission: VillageEventSubmissionCreateDelegate }).villageEventSubmission;
  const request = await delegate.findFirst({ where: { id: requestId, requesterId: session.id, villageId: membership.villageId } });
  if (!request) return { ok: false as const, error: "ไม่พบคำขอหรือคุณไม่มีสิทธิ์ดำเนินการ" };
  if (request.status !== "PENDING") return { ok: false as const, error: "แก้ไขหรือลบได้เฉพาะคำขอที่รอพิจารณา" };
  return { ok: true as const, delegate, request };
}

export async function updateResidentVillageEventSubmissionAction(requestId: string, data: RequestInput): Promise<{ success: true } | { success: false; error: string }> {
  const context = await residentRequestContext(requestId);
  if (!context.ok) return { success: false, error: context.error };
  const normalized = normalizeInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };
  try {
    await context.delegate.update({ where: { id: context.request.id }, data: normalized.value });
    revalidatePath("/resident/calendar/requests"); revalidatePath(`/resident/calendar/requests/${requestId}`); revalidatePath("/admin/calendar/requests");
    return { success: true };
  } catch { return { success: false, error: "บันทึกคำขอไม่สำเร็จ" }; }
}

export async function deleteResidentVillageEventSubmissionAction(requestId: string): Promise<{ success: true } | { success: false; error: string }> {
  const context = await residentRequestContext(requestId);
  if (!context.ok) return { success: false, error: context.error };
  try {
    await context.delegate.delete({ where: { id: context.request.id } });
    revalidatePath("/resident/calendar/requests"); revalidatePath("/admin/calendar/requests");
    return { success: true };
  } catch { return { success: false, error: "ลบคำขอไม่สำเร็จ" }; }
}

export async function createResidentEventChangeRequestAction(requestId: string, action: "EDIT" | "DELETE", reason: string): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบ" };
  const membership = getResidentMembership(session);
  if (!membership) return { success: false, error: "ไม่พบสิทธิ์ลูกบ้าน" };
  const delegate = (prisma as unknown as { villageEventSubmission: VillageEventSubmissionCreateDelegate }).villageEventSubmission;
  const source = await (delegate as unknown as { findFirst(args: unknown): Promise<{ id: string; status: string; eventId?: string | null; title: string; description: string | null; location: string | null; startsAt: Date; endsAt: Date | null; isPublic: boolean } | null> }).findFirst({ where: { id: requestId, requesterId: session.id, villageId: membership.villageId, status: "APPROVED" } });
  if (!source?.eventId) return { success: false, error: "คำขอนี้ยังไม่รองรับการเปลี่ยนแปลง กรุณาติดต่อผู้ใหญ่บ้าน" };
  const existing = await (delegate as unknown as { findFirst(args: unknown): Promise<{ id: string } | null> }).findFirst({ where: { villageId: membership.villageId, requesterId: session.id, eventId: source.eventId, type: action, status: "PENDING" } });
  if (existing) return { success: false, error: "มีคำขอประเภทนี้รอพิจารณาอยู่แล้ว" };
  const detail = reason.trim();
  if (!detail) return { success: false, error: "กรุณาระบุรายละเอียดหรือเหตุผล" };
  try {
    const created = await delegate.create({ data: { villageId: membership.villageId, requesterId: session.id, title: source.title, description: detail, location: source.location, startsAt: source.startsAt, endsAt: source.endsAt, isPublic: source.isPublic, type: action, eventId: source.eventId }, select: { id: true } });
    revalidatePath("/resident/calendar/requests"); revalidatePath(`/resident/calendar/requests/${requestId}`); revalidatePath("/admin/calendar/requests");
    return { success: true };
  } catch { return { success: false, error: "ส่งคำขอไม่สำเร็จ" }; }
}

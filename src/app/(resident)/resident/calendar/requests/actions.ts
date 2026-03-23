"use server";

import { NotificationType, VillageMembershipRole } from "@prisma/client";
import { z } from "zod";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

type VillageEventSubmissionCreateDelegate = {
  create(args: unknown): Promise<{ id: string }>;
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

  return { success: true, requestId: created.id };
}

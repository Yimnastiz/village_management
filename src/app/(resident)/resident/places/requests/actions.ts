"use server";

import { NotificationType, VillageMembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { normalizeVillagePlaceInput } from "@/lib/village-place";

type PlaceRequestInput = {
  name: string;
  category: string;
  description?: string;
  address?: string;
  openingHours?: string;
  contactPhone?: string;
  mapUrl?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  isPublic?: boolean;
  imageUrls?: string[];
};

type VillagePlaceSubmissionCreateDelegate = {
  create(args: unknown): Promise<{ id: string }>;
  findFirst(args: unknown): Promise<{ id: string } | null>;
};

type VillagePlaceDelegate = {
  findFirst(args: unknown): Promise<{ id: string; name: string; villageId: string } | null>;
};

const ADMIN_ROLES: VillageMembershipRole[] = [
  VillageMembershipRole.HEADMAN,
  VillageMembershipRole.ASSISTANT_HEADMAN,
  VillageMembershipRole.COMMITTEE,
];

export async function createVillagePlaceSubmissionAction(
  data: PlaceRequestInput
): Promise<{ success: true; requestId: string } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    return { success: false, error: "กรุณาเข้าสู่ระบบ" };
  }

  const membership = getResidentMembership(session);
  if (!membership) {
    return { success: false, error: "ไม่พบหมู่บ้านของคุณ" };
  }

  const normalized = normalizeVillagePlaceInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const villagePlaceSubmission =
    (prisma as unknown as { villagePlaceSubmission: VillagePlaceSubmissionCreateDelegate }).villagePlaceSubmission;

  const created = await villagePlaceSubmission.create({
    data: {
      villageId: membership.villageId,
      requesterId: session.id,
      type: "CREATE",
      payload: normalized.value,
      status: "PENDING",
    },
    select: { id: true },
  });

  const admins = await prisma.villageMembership.findMany({
    where: {
      villageId: membership.villageId,
      status: "ACTIVE",
      role: { in: ADMIN_ROLES },
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
        title: "มีคำขอเพิ่มสถานที่ใหม่",
        body: `${session.name} ขอเพิ่มสถานที่ "${normalized.value.name}"`,
        metadata: {
          actionUrl: `/admin/places/requests/${created.id}`,
          actionLabel: "ตรวจสอบคำขอ",
          requestId: created.id,
        },
      })),
    });
  }

  return { success: true, requestId: created.id };
}

export async function createVillagePlaceUpdateSubmissionAction(
  targetPlaceId: string,
  data: PlaceRequestInput
): Promise<{ success: true; requestId: string } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    return { success: false, error: "กรุณาเข้าสู่ระบบ" };
  }

  const membership = getResidentMembership(session);
  if (!membership) {
    return { success: false, error: "ไม่พบหมู่บ้านของคุณ" };
  }

  const normalized = normalizeVillagePlaceInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const villagePlace = (prisma as unknown as { villagePlace: VillagePlaceDelegate }).villagePlace;
  const place = await villagePlace.findFirst({
    where: { id: targetPlaceId, villageId: membership.villageId },
    select: { id: true, name: true, villageId: true },
  });
  if (!place) {
    return { success: false, error: "ไม่พบสถานที่ปลายทางที่ต้องการแก้ไข" };
  }

  const villagePlaceSubmission =
    (prisma as unknown as { villagePlaceSubmission: VillagePlaceSubmissionCreateDelegate }).villagePlaceSubmission;

  const existingPending = await villagePlaceSubmission.findFirst({
    where: {
      villageId: membership.villageId,
      requesterId: session.id,
      type: "UPDATE",
      targetPlaceId,
      status: "PENDING",
    },
    select: { id: true },
  });
  if (existingPending) {
    return { success: false, error: "มีคำขอแก้ไขสถานที่นี้ที่รออนุมัติอยู่แล้ว" };
  }

  const created = await villagePlaceSubmission.create({
    data: {
      villageId: membership.villageId,
      requesterId: session.id,
      type: "UPDATE",
      targetPlaceId,
      payload: normalized.value,
      status: "PENDING",
    },
    select: { id: true },
  });

  const admins = await prisma.villageMembership.findMany({
    where: {
      villageId: membership.villageId,
      status: "ACTIVE",
      role: { in: ADMIN_ROLES },
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
        title: "มีคำขอแก้ไขสถานที่",
        body: `${session.name} ขอแก้ไขสถานที่ "${place.name}"`,
        metadata: {
          actionUrl: `/admin/places/requests/${created.id}`,
          actionLabel: "ตรวจสอบคำขอ",
          requestId: created.id,
        },
      })),
    });
  }

  return { success: true, requestId: created.id };
}

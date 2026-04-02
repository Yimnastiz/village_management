"use server";

import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { normalizeVillagePlaceInput, parseVillagePlacePayload } from "@/lib/village-place";

type VillagePlaceRecord = {
  id: string;
  villageId: string;
  name: string;
  category: string;
  description: string | null;
  address: string | null;
  openingHours: string | null;
  contactPhone: string | null;
  mapUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrls: unknown;
  isPublic: boolean;
};

type VillagePlaceSubmissionRecord = {
  id: string;
  villageId: string;
  requesterId: string;
  type: string;
  targetPlaceId: string | null;
  payload: unknown;
  status: string;
};

type PlaceInput = {
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

type VillagePlaceDelegate = {
  create(args: unknown): Promise<{ id: string }>;
  findFirst(args: unknown): Promise<VillagePlaceRecord | null>;
  update(args: unknown): Promise<{ id: string }>;
  delete(args: unknown): Promise<{ id: string }>;
};

type VillagePlaceSubmissionDelegate = {
  findFirst(args: unknown): Promise<VillagePlaceSubmissionRecord | null>;
  update(args: unknown): Promise<{ id: string }>;
};

async function requireAdminVillage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    return { ok: false as const, error: "กรุณาเข้าสู่ระบบ", session: null, villageId: "" };
  }
  if (!isAdminUser(session)) {
    return { ok: false as const, error: "ไม่มีสิทธิ์ดำเนินการ", session: null, villageId: "" };
  }

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) {
    return { ok: false as const, error: "ไม่พบหมู่บ้านของคุณ", session: null, villageId: "" };
  }

  return {
    ok: true as const,
    error: null,
    session,
    villageId: membership.villageId,
  };
}

export async function adminCreateVillagePlaceAction(
  data: PlaceInput
): Promise<{ success: true; placeId: string } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeVillagePlaceInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const villagePlace = (prisma as unknown as { villagePlace: VillagePlaceDelegate }).villagePlace;

  const created = await villagePlace.create({
    data: {
      villageId: ctx.villageId,
      name: normalized.value.name,
      category: normalized.value.category,
      description: normalized.value.description || null,
      address: normalized.value.address || null,
      openingHours: normalized.value.openingHours || null,
      contactPhone: normalized.value.contactPhone || null,
      mapUrl: normalized.value.mapUrl || null,
      latitude: normalized.value.latitude,
      longitude: normalized.value.longitude,
      isPublic: normalized.value.isPublic,
      imageUrls: normalized.value.imageUrls,
      createdById: ctx.session.id,
    },
    select: { id: true },
  });

  return { success: true, placeId: created.id };
}

export async function adminUpdateVillagePlaceAction(
  placeId: string,
  data: PlaceInput
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeVillagePlaceInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const villagePlace = (prisma as unknown as { villagePlace: VillagePlaceDelegate }).villagePlace;
  const existing = await villagePlace.findFirst({
    where: { id: placeId, villageId: ctx.villageId },
    select: { id: true },
  });

  if (!existing) {
    return { success: false, error: "ไม่พบสถานที่ที่ต้องการแก้ไข" };
  }

  await villagePlace.update({
    where: { id: placeId },
    data: {
      name: normalized.value.name,
      category: normalized.value.category,
      description: normalized.value.description || null,
      address: normalized.value.address || null,
      openingHours: normalized.value.openingHours || null,
      contactPhone: normalized.value.contactPhone || null,
      mapUrl: normalized.value.mapUrl || null,
      latitude: normalized.value.latitude,
      longitude: normalized.value.longitude,
      isPublic: normalized.value.isPublic,
      imageUrls: normalized.value.imageUrls,
    },
    select: { id: true },
  });

  return { success: true };
}

export async function adminDeleteVillagePlaceAction(
  placeId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const villagePlace = (prisma as unknown as { villagePlace: VillagePlaceDelegate }).villagePlace;
  const existing = await villagePlace.findFirst({
    where: { id: placeId, villageId: ctx.villageId },
    select: { id: true },
  });

  if (!existing) {
    return { success: false, error: "ไม่พบสถานที่ที่ต้องการลบ" };
  }

  await villagePlace.delete({ where: { id: placeId }, select: { id: true } });
  return { success: true };
}

export async function adminApproveVillagePlaceSubmissionAction(
  submissionId: string,
  reviewNote?: string
): Promise<{ success: true; placeId: string } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const villagePlaceSubmission =
    (prisma as unknown as { villagePlaceSubmission: VillagePlaceSubmissionDelegate }).villagePlaceSubmission;
  const villagePlace = (prisma as unknown as { villagePlace: VillagePlaceDelegate }).villagePlace;

  const submission = await villagePlaceSubmission.findFirst({
    where: {
      id: submissionId,
      villageId: ctx.villageId,
      status: "PENDING",
    },
    select: {
      id: true,
      villageId: true,
      requesterId: true,
      type: true,
      targetPlaceId: true,
      payload: true,
      status: true,
    },
  });

  if (!submission) {
    return { success: false, error: "ไม่พบคำขอนี้หรือคำขอถูกดำเนินการแล้ว" };
  }

  const payload = parseVillagePlacePayload(submission.payload);
  if (!payload) {
    return { success: false, error: "ข้อมูลคำขอไม่ถูกต้อง ไม่สามารถอนุมัติได้" };
  }

  let created: { id: string };
  try {
    created = await prisma.$transaction(async (tx) => {
    const txPlace = (tx as unknown as { villagePlace: VillagePlaceDelegate }).villagePlace;
    const txSubmission =
      (tx as unknown as { villagePlaceSubmission: VillagePlaceSubmissionDelegate }).villagePlaceSubmission;

    let place: { id: string };
    if (submission.type === "UPDATE") {
      if (!submission.targetPlaceId) {
        throw new Error("คำขอแก้ไขไม่มีสถานที่ปลายทาง");
      }

      const target = await txPlace.findFirst({
        where: { id: submission.targetPlaceId, villageId: ctx.villageId },
        select: { id: true },
      });
      if (!target) {
        throw new Error("ไม่พบสถานที่ปลายทางสำหรับคำขอนี้");
      }

      place = await txPlace.update({
        where: { id: target.id },
        data: {
          name: payload.name,
          category: payload.category,
          description: payload.description || null,
          address: payload.address || null,
          openingHours: payload.openingHours || null,
          contactPhone: payload.contactPhone || null,
          mapUrl: payload.mapUrl || null,
          latitude: payload.latitude,
          longitude: payload.longitude,
          imageUrls: payload.imageUrls,
          isPublic: payload.isPublic,
        },
        select: { id: true },
      });
    } else {
      place = await txPlace.create({
        data: {
          villageId: ctx.villageId,
          name: payload.name,
          category: payload.category,
          description: payload.description || null,
          address: payload.address || null,
          openingHours: payload.openingHours || null,
          contactPhone: payload.contactPhone || null,
          mapUrl: payload.mapUrl || null,
          latitude: payload.latitude,
          longitude: payload.longitude,
          imageUrls: payload.imageUrls,
          isPublic: payload.isPublic,
          createdById: submission.requesterId,
        },
        select: { id: true },
      });
    }

    await txSubmission.update({
      where: { id: submission.id },
      data: {
        status: "APPROVED",
        reviewedBy: ctx.session.id,
        reviewedAt: new Date(),
        reviewNote: reviewNote?.trim() || null,
      },
      select: { id: true },
    });

    await tx.notification.create({
      data: {
        villageId: ctx.villageId,
        userId: submission.requesterId,
        type: NotificationType.SYSTEM,
        title: submission.type === "UPDATE" ? "คำขอแก้ไขสถานที่ของคุณได้รับการอนุมัติ" : "คำขอเพิ่มสถานที่ของคุณได้รับการอนุมัติ",
        body: `สถานที่: ${payload.name}`,
        metadata: {
          submissionId: submission.id,
          placeId: place.id,
          status: "APPROVED",
          actionUrl: `/resident/places/requests`,
        },
      },
    });

      return place;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถอนุมัติคำขอได้";
    return { success: false, error: message };
  }

  return { success: true, placeId: created.id };
}

export async function adminRejectVillagePlaceSubmissionAction(
  submissionId: string,
  reviewNote?: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const villagePlaceSubmission =
    (prisma as unknown as { villagePlaceSubmission: VillagePlaceSubmissionDelegate }).villagePlaceSubmission;

  const existing = await villagePlaceSubmission.findFirst({
    where: { id: submissionId, villageId: ctx.villageId, status: "PENDING" },
    select: { id: true, requesterId: true, villageId: true, payload: true, status: true },
  });

  if (!existing) {
    return { success: false, error: "ไม่พบคำขอนี้หรือคำขอถูกดำเนินการแล้ว" };
  }

  await prisma.$transaction(async (tx) => {
    const txSubmission =
      (tx as unknown as { villagePlaceSubmission: VillagePlaceSubmissionDelegate }).villagePlaceSubmission;

    await txSubmission.update({
      where: { id: submissionId },
      data: {
        status: "REJECTED",
        reviewedBy: ctx.session.id,
        reviewedAt: new Date(),
        reviewNote: reviewNote?.trim() || null,
      },
      select: { id: true },
    });

    await tx.notification.create({
      data: {
        villageId: ctx.villageId,
        userId: existing.requesterId,
        type: NotificationType.SYSTEM,
        title: "คำขอเพิ่มสถานที่ของคุณไม่ได้รับการอนุมัติ",
        body: reviewNote?.trim() || "โปรดตรวจสอบหมายเหตุจากผู้ดูแล",
        metadata: {
          submissionId,
          status: "REJECTED",
          actionUrl: `/resident/places/requests`,
        },
      },
    });
  });

  return { success: true };
}

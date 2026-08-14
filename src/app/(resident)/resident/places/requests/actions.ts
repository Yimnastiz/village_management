"use server";

import { NotificationType, VillageMembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { normalizeVillagePlaceInput } from "@/lib/village-place";
import type { PlaceImageInput } from "@/lib/place-image";
import { sanitizeSubmissionImages } from "@/lib/place-image.server";

type PlaceRequestInput = { name: string; category: string; description?: string; address?: string; openingHours?: string; contactPhone?: string; mapUrl?: string; latitude?: number | string | null; longitude?: number | string | null; images?: PlaceImageInput[] };
const REVIEWER_ROLES = [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN, VillageMembershipRole.COMMITTEE] as const;

async function getResidentContext() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return null;
  const membership = getResidentMembership(session);
  return membership ? { session, membership } : null;
}

async function safeResidentPayload(data: PlaceRequestInput, villageId: string, targetPlaceId?: string) {
  const normalized = normalizeVillagePlaceInput(data);
  if (!normalized.ok) return normalized;
  const images = await sanitizeSubmissionImages(prisma, normalized.value.images, villageId, targetPlaceId);
  if (!images) return { ok: false as const, error: "ข้อมูลรูปภาพไม่ถูกต้อง กรุณาอัปโหลดใหม่อีกครั้ง" };
  const { isPublic: _ignoredVisibility, images: _images, ...fields } = normalized.value;
  // Visibility is a publishing decision owned by village administrators.
  return { ok: true as const, value: { ...fields, images, isPublic: false } };
}

async function notifyReviewers(villageId: string, requestId: string, requesterName: string, name: string, type: "CREATE" | "UPDATE") {
  const reviewers = await prisma.villageMembership.findMany({ where: { villageId, status: "ACTIVE", role: { in: [...REVIEWER_ROLES] } }, distinct: ["userId"], select: { userId: true } });
  if (!reviewers.length) return;
  const isUpdate = type === "UPDATE";
  await prisma.notification.createMany({ data: reviewers.map(({ userId }) => ({ userId, villageId, type: NotificationType.SYSTEM, title: isUpdate ? "มีคำขอแก้ไขสถานที่" : "มีคำขอเพิ่มสถานที่ใหม่", body: `${requesterName} ขอ${isUpdate ? "แก้ไข" : "เพิ่ม"}สถานที่ “${name}”`, metadata: { actionUrl: `/admin/places/requests/${requestId}`, actionLabel: "ตรวจสอบคำขอ", requestId } })) });
}

export async function createVillagePlaceSubmissionAction(data: PlaceRequestInput): Promise<{ success: true; requestId: string } | { success: false; error: string }> {
  const ctx = await getResidentContext();
  if (!ctx) return { success: false, error: "ไม่พบสิทธิ์ลูกบ้านสำหรับส่งคำขอสถานที่" };
  const payload = await safeResidentPayload(data, ctx.membership.villageId);
  if (!payload.ok) return { success: false, error: payload.error };
  try {
    const created = await prisma.villagePlaceSubmission.create({ data: { villageId: ctx.membership.villageId, requesterId: ctx.session.id, type: "CREATE", payload: payload.value, status: "PENDING" }, select: { id: true } });
    await notifyReviewers(ctx.membership.villageId, created.id, ctx.session.name, payload.value.name, "CREATE");
    revalidatePath("/resident/places/requests");
    return { success: true, requestId: created.id };
  } catch (error) { console.error("create village place submission", error); return { success: false, error: "ไม่สามารถส่งคำขอสถานที่ได้ กรุณาลองใหม่อีกครั้ง" }; }
}

export async function createVillagePlaceUpdateSubmissionAction(targetPlaceId: string, data: PlaceRequestInput): Promise<{ success: true; requestId: string } | { success: false; error: string }> {
  const ctx = await getResidentContext();
  if (!ctx) return { success: false, error: "ไม่พบสิทธิ์ลูกบ้านสำหรับส่งคำขอสถานที่" };
  const place = await prisma.villagePlace.findFirst({ where: { id: targetPlaceId, villageId: ctx.membership.villageId }, select: { id: true, name: true, createdById: true } });
  if (!place) return { success: false, error: "ไม่พบสถานที่ที่ต้องการเสนอแก้ไข" };
  if (place.createdById !== ctx.session.id) return { success: false, error: "คุณสามารถเสนอแก้ไขได้เฉพาะสถานที่ที่คุณเป็นผู้เสนอสร้าง" };
  const payload = await safeResidentPayload(data, ctx.membership.villageId, targetPlaceId);
  if (!payload.ok) return { success: false, error: payload.error };
  const existingPending = await prisma.villagePlaceSubmission.findFirst({ where: { villageId: ctx.membership.villageId, requesterId: ctx.session.id, type: "UPDATE", targetPlaceId, status: "PENDING" }, select: { id: true } });
  if (existingPending) return { success: false, error: "มีคำขอแก้ไขสถานที่นี้ที่รอพิจารณาอยู่แล้ว" };
  try {
    const created = await prisma.villagePlaceSubmission.create({ data: { villageId: ctx.membership.villageId, requesterId: ctx.session.id, type: "UPDATE", targetPlaceId, payload: payload.value, status: "PENDING" }, select: { id: true } });
    await notifyReviewers(ctx.membership.villageId, created.id, ctx.session.name, place.name, "UPDATE");
    revalidatePath("/resident/places/requests");
    return { success: true, requestId: created.id };
  } catch (error) { console.error("create village place update submission", error); return { success: false, error: "ไม่สามารถส่งคำขอแก้ไขสถานที่ได้ กรุณาลองใหม่อีกครั้ง" }; }
}

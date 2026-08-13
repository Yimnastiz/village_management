"use server";

import { NotificationType, VillageMembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { normalizeVillagePlaceInput } from "@/lib/village-place";

type PlaceRequestInput = { name: string; category: string; description?: string; address?: string; openingHours?: string; contactPhone?: string; mapUrl?: string; latitude?: number | string | null; longitude?: number | string | null; imageUrls?: string[] };
const REVIEWER_ROLES = [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN, VillageMembershipRole.COMMITTEE] as const;
const RESIDENT_ALLOWED_PLACE_CATEGORIES = new Set(["SHOP", "OTHER"]);

async function getResidentContext() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return null;
  const membership = getResidentMembership(session);
  return membership ? { session, membership } : null;
}

function safeResidentPayload(data: PlaceRequestInput) {
  const normalized = normalizeVillagePlaceInput(data);
  if (!normalized.ok) return normalized;
  if (!RESIDENT_ALLOWED_PLACE_CATEGORIES.has(normalized.value.category)) return { ok: false as const, error: "ลูกบ้านสามารถเสนอร้านค้า/ตลาดหรือสถานที่ทั่วไปได้" };
  const { isPublic: _ignoredVisibility, ...fields } = normalized.value;
  // Visibility is a publishing decision owned by village administrators.
  return { ok: true as const, value: { ...fields, isPublic: false } };
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
  const payload = safeResidentPayload(data);
  if (!payload.ok) return { success: false, error: payload.error };
  try {
    const created = await prisma.villagePlaceSubmission.create({ data: { villageId: ctx.membership.villageId, requesterId: ctx.session.id, type: "CREATE", payload: payload.value, status: "PENDING" }, select: { id: true } });
    await notifyReviewers(ctx.membership.villageId, created.id, ctx.session.name, payload.value.name, "CREATE");
    return { success: true, requestId: created.id };
  } catch (error) { console.error("create village place submission", error); return { success: false, error: "ไม่สามารถส่งคำขอสถานที่ได้ กรุณาลองใหม่อีกครั้ง" }; }
}

export async function createVillagePlaceUpdateSubmissionAction(targetPlaceId: string, data: PlaceRequestInput): Promise<{ success: true; requestId: string } | { success: false; error: string }> {
  const ctx = await getResidentContext();
  if (!ctx) return { success: false, error: "ไม่พบสิทธิ์ลูกบ้านสำหรับส่งคำขอสถานที่" };
  const payload = safeResidentPayload(data);
  if (!payload.ok) return { success: false, error: payload.error };
  const place = await prisma.villagePlace.findFirst({ where: { id: targetPlaceId, villageId: ctx.membership.villageId }, select: { id: true, name: true } });
  if (!place) return { success: false, error: "ไม่พบสถานที่ที่ต้องการเสนอแก้ไข" };
  const existingPending = await prisma.villagePlaceSubmission.findFirst({ where: { villageId: ctx.membership.villageId, requesterId: ctx.session.id, type: "UPDATE", targetPlaceId, status: "PENDING" }, select: { id: true } });
  if (existingPending) return { success: false, error: "มีคำขอแก้ไขสถานที่นี้ที่รอพิจารณาอยู่แล้ว" };
  try {
    const created = await prisma.villagePlaceSubmission.create({ data: { villageId: ctx.membership.villageId, requesterId: ctx.session.id, type: "UPDATE", targetPlaceId, payload: payload.value, status: "PENDING" }, select: { id: true } });
    await notifyReviewers(ctx.membership.villageId, created.id, ctx.session.name, place.name, "UPDATE");
    return { success: true, requestId: created.id };
  } catch (error) { console.error("create village place update submission", error); return { success: false, error: "ไม่สามารถส่งคำขอแก้ไขสถานที่ได้ กรุณาลองใหม่อีกครั้ง" }; }
}

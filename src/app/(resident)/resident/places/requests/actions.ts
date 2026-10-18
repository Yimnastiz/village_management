"use server";

import { AuditAction, NotificationType, VillageMembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { normalizeVillagePlaceInput } from "@/lib/village-place";
import type { PlaceImageInput } from "@/lib/place-image";
import { sanitizeSubmissionImages } from "@/lib/place-image.server";
import { getResidentActorDisplayByUserId } from "@/lib/resident-actor-display";
import { writeVillageAuditLog } from "@/lib/audit-log";

type PlaceRequestInput = { name: string; category: string; description?: string; address?: string; openingHours?: string; contactPhone?: string; mapUrl?: string; latitude?: number | string | null; longitude?: number | string | null; isPublic?: boolean; images?: PlaceImageInput[] };
const REVIEWER_ROLES = [VillageMembershipRole.HEADMAN] as const;

async function getResidentContext() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return null;
  const membership = getResidentMembership(session);
  if (!membership) return null;
  const actor = await getResidentActorDisplayByUserId(session.id, { villageId: membership.villageId });
  return { session: { ...session, name: actor.label }, membership };
}

async function safeResidentPayload(data: PlaceRequestInput, villageId: string, targetPlaceId?: string) {
  const normalized = normalizeVillagePlaceInput(data);
  if (!normalized.ok) return normalized;
  const images = await sanitizeSubmissionImages(prisma, normalized.value.images, villageId, targetPlaceId);
  if (!images) return { ok: false as const, error: "ข้อมูลรูปภาพไม่ถูกต้อง กรุณาอัปโหลดใหม่อีกครั้ง" };
  const { images: _images, ...fields } = normalized.value;
  // This value is the resident's proposal; the reviewer makes the final decision.
  return { ok: true as const, value: { ...fields, images } };
}

async function notifyReviewers(villageId: string, requestId: string, requesterName: string, name: string, type: "CREATE" | "UPDATE" | "DELETE") {
  const reviewers = await prisma.villageMembership.findMany({ where: { villageId, status: "ACTIVE", role: { in: [...REVIEWER_ROLES] } }, distinct: ["userId"], select: { userId: true } });
  if (!reviewers.length) return;
  const action = type === "DELETE" ? "ลบ" : type === "UPDATE" ? "แก้ไข" : "เพิ่ม";
  await prisma.notification.createMany({ data: reviewers.map(({ userId }) => ({ userId, villageId, type: NotificationType.SYSTEM, title: `มีคำขอ${action}สถานที่จากสมาชิก`, body: `${requesterName} ขอให้พิจารณา${action} “${name}”`, metadata: { source: "PLACE", actionUrl: `/admin/places/requests/${requestId}`, actionLabel: "ตรวจสอบคำขอ", requestId } })) });
}

export async function createVillagePlaceSubmissionAction(data: PlaceRequestInput): Promise<{ success: true; requestId: string } | { success: false; error: string }> {
  const ctx = await getResidentContext();
  if (!ctx) return { success: false, error: "ไม่พบสิทธิ์สมาชิกสำหรับส่งคำขอสถานที่" };
  const payload = await safeResidentPayload(data, ctx.membership.villageId);
  if (!payload.ok) return { success: false, error: payload.error };
  try {
    const created = await prisma.$transaction(async (tx) => {
      const request = await tx.villagePlaceSubmission.create({ data: { villageId: ctx.membership.villageId, requesterId: ctx.session.id, type: "CREATE", payload: payload.value, status: "PENDING" }, select: { id: true } });
      await writeVillageAuditLog(tx, { userId: ctx.session.id, villageId: ctx.membership.villageId, actorAuthSessionId: ctx.session.authSessionId, action: AuditAction.CREATE, resource: "VillagePlaceSubmission", resourceId: request.id, metadata: { actorRole: "RESIDENT", actorLabel: ctx.session.name, actionName: "PLACE_CREATE_REQUEST_SUBMITTED", requestType: "CREATE", name: payload.value.name } });
      return request;
    });
    await notifyReviewers(ctx.membership.villageId, created.id, ctx.session.name, payload.value.name, "CREATE");
    revalidatePath("/resident/places/requests");
    return { success: true, requestId: created.id };
  } catch (error) { console.error("create village place submission", error); return { success: false, error: "ไม่สามารถส่งคำขอสถานที่ได้ กรุณาลองใหม่อีกครั้ง" }; }
}

export async function createVillagePlaceUpdateSubmissionAction(targetPlaceId: string, data: PlaceRequestInput): Promise<{ success: true; requestId: string } | { success: false; error: string }> {
  const ctx = await getResidentContext();
  if (!ctx) return { success: false, error: "ไม่พบสิทธิ์สมาชิกสำหรับส่งคำขอสถานที่" };
  const place = await prisma.villagePlace.findFirst({ where: { id: targetPlaceId, villageId: ctx.membership.villageId }, select: { id: true, name: true, createdById: true } });
  if (!place) return { success: false, error: "ไม่พบสถานที่ที่ต้องการเสนอแก้ไข" };
  if (place.createdById !== ctx.session.id) return { success: false, error: "คุณสามารถเสนอแก้ไขได้เฉพาะสถานที่ที่คุณเป็นผู้เสนอสร้าง" };
  const payload = await safeResidentPayload(data, ctx.membership.villageId, targetPlaceId);
  if (!payload.ok) return { success: false, error: payload.error };
  const existingPending = await prisma.villagePlaceSubmission.findFirst({ where: { villageId: ctx.membership.villageId, requesterId: ctx.session.id, type: { in: ["UPDATE", "DELETE"] }, targetPlaceId, status: "PENDING" }, select: { type: true } });
  if (existingPending) return { success: false, error: existingPending.type === "DELETE" ? "มีคำขอลบสถานที่นี้ที่รอพิจารณาอยู่ จึงยังส่งคำขอแก้ไขไม่ได้" : "มีคำขอแก้ไขสถานที่นี้ที่รอพิจารณาอยู่แล้ว" };
  try {
    const created = await prisma.$transaction(async (tx) => {
      const request = await tx.villagePlaceSubmission.create({ data: { villageId: ctx.membership.villageId, requesterId: ctx.session.id, type: "UPDATE", targetPlaceId, payload: payload.value, status: "PENDING" }, select: { id: true } });
      await writeVillageAuditLog(tx, { userId: ctx.session.id, villageId: ctx.membership.villageId, actorAuthSessionId: ctx.session.authSessionId, action: AuditAction.CREATE, resource: "VillagePlaceSubmission", resourceId: request.id, metadata: { actorRole: "RESIDENT", actorLabel: ctx.session.name, actionName: "PLACE_UPDATE_REQUEST_SUBMITTED", requestType: "UPDATE", name: payload.value.name, targetPlaceId } });
      return request;
    });
    await notifyReviewers(ctx.membership.villageId, created.id, ctx.session.name, place.name, "UPDATE");
    revalidatePath("/resident/places/requests");
    return { success: true, requestId: created.id };
  } catch (error) { console.error("create village place update submission", error); return { success: false, error: "ไม่สามารถส่งคำขอแก้ไขสถานที่ได้ กรุณาลองใหม่อีกครั้ง" }; }
}

export async function createVillagePlaceDeleteSubmissionAction(targetPlaceId: string, reasonInput: string): Promise<{ success: true; requestId: string } | { success: false; error: string }> {
  const ctx = await getResidentContext();
  if (!ctx) return { success: false, error: "ไม่พบสิทธิ์สมาชิกสำหรับส่งคำขอสถานที่" };
  const reason = reasonInput.trim();
  if (reason.length < 5) return { success: false, error: "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร" };
  const place = await prisma.villagePlace.findFirst({ where: { id: targetPlaceId, villageId: ctx.membership.villageId }, select: { id: true, name: true, category: true, address: true, isPublic: true, createdById: true, images: { orderBy: { sortOrder: "asc" }, select: { id: true, fileKey: true, sortOrder: true, isCover: true } } } });
  if (!place) return { success: false, error: "ไม่พบสถานที่ที่ต้องการขอลบ" };
  if (place.createdById !== ctx.session.id) return { success: false, error: "คุณสามารถขอลบได้เฉพาะสถานที่ที่คุณเป็นผู้เสนอสร้าง" };
  const existingPending = await prisma.villagePlaceSubmission.findFirst({ where: { villageId: ctx.membership.villageId, requesterId: ctx.session.id, type: { in: ["UPDATE", "DELETE"] }, targetPlaceId, status: "PENDING" }, select: { type: true } });
  if (existingPending) return { success: false, error: existingPending.type === "DELETE" ? "มีคำขอลบสถานที่นี้ที่รอพิจารณาอยู่แล้ว" : "มีคำขอแก้ไขสถานที่นี้ที่รอพิจารณาอยู่ กรุณารอให้พิจารณาเสร็จก่อนขอลบ" };
  try {
    const request = await prisma.$transaction(async (tx) => {
      const created = await tx.villagePlaceSubmission.create({ data: { villageId: ctx.membership.villageId, requesterId: ctx.session.id, type: "DELETE", targetPlaceId, approvedPlaceId: null, status: "PENDING", payload: { name: place.name, category: place.category, description: "", address: place.address ?? "", openingHours: "", contactPhone: "", mapUrl: "", latitude: null, longitude: null, isPublic: place.isPublic, images: place.images, requestReason: reason } }, select: { id: true } });
      await writeVillageAuditLog(tx, { userId: ctx.session.id, villageId: ctx.membership.villageId, actorAuthSessionId: ctx.session.authSessionId, action: AuditAction.CREATE, resource: "VillagePlaceSubmission", resourceId: created.id, metadata: { actorRole: "RESIDENT", actorLabel: ctx.session.name, actionName: "PLACE_DELETE_REQUEST_SUBMITTED", requestType: "DELETE", name: place.name, targetPlaceId } });
      return created;
    });
    await notifyReviewers(ctx.membership.villageId, request.id, ctx.session.name, place.name, "DELETE");
    revalidatePath("/resident/places/requests");
    return { success: true, requestId: request.id };
  } catch (error) { console.error("create village place delete submission", error); return { success: false, error: "ไม่สามารถส่งคำขอลบสถานที่ได้ กรุณาลองใหม่อีกครั้ง" }; }
}

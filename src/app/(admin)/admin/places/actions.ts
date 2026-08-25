"use server";

import { AuditAction, NotificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { revalidateAdminSidebar } from "@/lib/revalidate-admin-sidebar";
import { getAdminMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { normalizeVillagePlaceInput, parseVillagePlacePayload } from "@/lib/village-place";
import type { PlaceImageInput } from "@/lib/place-image";
import { materializePlaceImages, replacePlaceImages } from "@/lib/place-image.server";
import { deletePlaceUploads } from "@/lib/place-upload.server";

type PlaceInput = {
  name: string; category: string; description?: string; address?: string; openingHours?: string;
  contactPhone?: string; mapUrl?: string; latitude?: number | string | null; longitude?: number | string | null;
  isPublic?: boolean; isFeatured?: boolean; images?: PlaceImageInput[];
};

type Submission = {
  id: string; villageId: string; requesterId: string; type: "CREATE" | "UPDATE"; targetPlaceId: string | null; payload: unknown; status: string;
};

async function requireAdminVillage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { ok: false as const, error: "กรุณาเข้าสู่ระบบ" };
  const membership = getAdminMembership(session);
  if (!membership) return { ok: false as const, error: "ไม่พบสิทธิ์ผู้ดูแลหมู่บ้าน" };
  return { ok: true as const, session, villageId: membership.villageId };
}

function revalidatePlacePaths(placeId?: string, requestId?: string) {
  ["/admin/places", "/admin/places/requests", "/resident/places", "/resident/places/requests", "/resident/saved", ...(placeId ? [`/admin/places/${placeId}`, `/resident/places/${placeId}`] : []), ...(requestId ? [`/admin/places/requests/${requestId}`, `/resident/places/requests/${requestId}`] : [])].forEach((path) => revalidatePath(path));
  revalidateAdminSidebar();
}

export async function adminCreateVillagePlaceAction(data: PlaceInput): Promise<{ success: true; placeId: string } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const normalized = normalizeVillagePlaceInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };
  const imageRows = await materializePlaceImages(prisma, normalized.value.images, ctx.villageId);
  if (!imageRows) return { success: false, error: "ข้อมูลรูปภาพไม่ถูกต้อง กรุณาอัปโหลดใหม่อีกครั้ง" };
  const place = await prisma.$transaction(async (tx) => {
    const { images: _images, ...fields } = normalized.value;
    const created = await tx.villagePlace.create({ data: { villageId: ctx.villageId, ...fields, imageUrls: [], isFeatured: Boolean(data.isFeatured), description: fields.description || null, address: fields.address || null, openingHours: fields.openingHours || null, contactPhone: fields.contactPhone || null, mapUrl: fields.mapUrl || null, createdById: ctx.session.id }, select: { id: true, name: true } });
    await replacePlaceImages(tx, created.id, imageRows);
    await tx.auditLog.create({ data: { userId: ctx.session.id, villageId: ctx.villageId, action: AuditAction.CREATE, resource: "VillagePlace", resourceId: created.id, metadata: { actionName: "PLACE_CREATED", name: created.name } } });
    return created;
  });
  revalidatePlacePaths(place.id);
  return { success: true, placeId: place.id };
}

export async function adminUpdateVillagePlaceAction(placeId: string, data: PlaceInput): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const normalized = normalizeVillagePlaceInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };
  const imageRows = await materializePlaceImages(prisma, normalized.value.images, ctx.villageId, { existingPlaceId: placeId });
  if (!imageRows) return { success: false, error: "ข้อมูลรูปภาพไม่ถูกต้อง กรุณาอัปโหลดใหม่อีกครั้ง" };
  const currentFileKeys = await prisma.villagePlaceImage.findMany({ where: { placeId }, select: { fileKey: true } });
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.villagePlace.findFirst({ where: { id: placeId, villageId: ctx.villageId }, select: { id: true, name: true, isPublic: true, isFeatured: true } });
    if (!existing) return false;
    const { images: _images, ...fields } = normalized.value;
    const updated = await tx.villagePlace.update({ where: { id: placeId }, data: { ...fields, imageUrls: [], isFeatured: Boolean(data.isFeatured), description: fields.description || null, address: fields.address || null, openingHours: fields.openingHours || null, contactPhone: fields.contactPhone || null, mapUrl: fields.mapUrl || null }, select: { id: true, name: true, isPublic: true, isFeatured: true } });
    await replacePlaceImages(tx, placeId, imageRows);
    await tx.auditLog.create({ data: { userId: ctx.session.id, villageId: ctx.villageId, action: AuditAction.UPDATE, resource: "VillagePlace", resourceId: placeId, metadata: { actionName: "PLACE_UPDATED", oldValue: { name: existing.name, isPublic: existing.isPublic, isFeatured: existing.isFeatured }, newValue: { name: updated.name, isPublic: updated.isPublic, isFeatured: updated.isFeatured } } } });
    return true;
  });
  if (!result) return { success: false, error: "ไม่พบสถานที่ที่ต้องการแก้ไข" };
  const retained = new Set(imageRows.flatMap((image) => image.fileKey ? [image.fileKey] : []));
  await deletePlaceUploads(currentFileKeys.flatMap((image) => image.fileKey && !retained.has(image.fileKey) ? [image.fileKey] : []));
  revalidatePlacePaths(placeId);
  return { success: true };
}

export async function adminDeleteVillagePlaceAction(placeId: string): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.villagePlace.findFirst({ where: { id: placeId, villageId: ctx.villageId }, select: { id: true, name: true, images: { select: { fileKey: true } } } });
    if (!existing) return false;
    await tx.savedItem.deleteMany({ where: { placeId } });
    await tx.villagePlace.delete({ where: { id: placeId } });
    await tx.auditLog.create({ data: { userId: ctx.session.id, villageId: ctx.villageId, action: AuditAction.DELETE, resource: "VillagePlace", resourceId: placeId, metadata: { actionName: "PLACE_DELETED", name: existing.name } } });
    return existing.images.flatMap((image) => image.fileKey ? [image.fileKey] : []);
  });
  if (!result) return { success: false, error: "ไม่พบสถานที่ที่ต้องการลบ" };
  await deletePlaceUploads(result);
  revalidatePlacePaths(placeId);
  return { success: true };
}

async function findPendingSubmission(submissionId: string, villageId: string): Promise<Submission | null> {
  return prisma.villagePlaceSubmission.findFirst({ where: { id: submissionId, villageId, status: "PENDING" }, select: { id: true, villageId: true, requesterId: true, type: true, targetPlaceId: true, payload: true, status: true } });
}

export async function adminApproveVillagePlaceSubmissionAction(submissionId: string): Promise<{ success: true; placeId: string } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const submission = await findPendingSubmission(submissionId, ctx.villageId);
  if (!submission) return { success: false, error: "ไม่พบคำขอนี้หรือคำขอถูกดำเนินการแล้ว" };
  const payload = parseVillagePlacePayload(submission.payload);
  if (!payload) return { success: false, error: "ข้อมูลคำขอไม่ถูกต้อง ไม่สามารถอนุมัติได้" };
  try {
    let removedFileKeys: string[] = [];
    const result = await prisma.$transaction(async (tx) => {
      // The conditional state transition is the claim: only one admin can proceed.
      const claimed = await tx.villagePlaceSubmission.updateMany({ where: { id: submission.id, villageId: ctx.villageId, status: "PENDING" }, data: { status: "APPROVED", reviewedBy: ctx.session.id, reviewedAt: new Date(), reviewNote: null } });
      if (claimed.count !== 1) throw new Error("คำขอนี้ถูกดำเนินการแล้ว");
      let place;
      if (submission.type === "UPDATE") {
        if (!submission.targetPlaceId) throw new Error("PLACE_TARGET_NOT_FOUND");
        const target = await tx.villagePlace.findFirst({ where: { id: submission.targetPlaceId, villageId: ctx.villageId }, select: { id: true, images: { select: { fileKey: true } } } });
        if (!target) throw new Error("PLACE_TARGET_NOT_FOUND");
        // Resident submissions never control visibility or the featured flag.
        const imageRows = await materializePlaceImages(tx, payload.images, ctx.villageId, { existingPlaceId: target.id, trustedNew: true });
        if (!imageRows) throw new Error("INVALID_PLACE_IMAGES");
        const { isPublic: _submittedVisibility, images: _images, ...placeChanges } = payload;
        place = await tx.villagePlace.update({ where: { id: target.id }, data: { ...placeChanges, description: payload.description || null, address: payload.address || null, openingHours: payload.openingHours || null, contactPhone: payload.contactPhone || null, mapUrl: payload.mapUrl || null }, select: { id: true } });
        await replacePlaceImages(tx, place.id, imageRows);
        const retained = new Set(imageRows.flatMap((image) => image.fileKey ? [image.fileKey] : []));
        removedFileKeys = target.images.flatMap((image) => image.fileKey && !retained.has(image.fileKey) ? [image.fileKey] : []);
      } else {
        const imageRows = await materializePlaceImages(tx, payload.images, ctx.villageId, { trustedNew: true });
        if (!imageRows) throw new Error("INVALID_PLACE_IMAGES");
        const { images: _images, ...placeFields } = payload;
        place = await tx.villagePlace.create({ data: { villageId: ctx.villageId, ...placeFields, imageUrls: [], isPublic: false, description: payload.description || null, address: payload.address || null, openingHours: payload.openingHours || null, contactPhone: payload.contactPhone || null, mapUrl: payload.mapUrl || null, isFeatured: false, createdById: submission.requesterId }, select: { id: true } });
        await replacePlaceImages(tx, place.id, imageRows);
      }
      await tx.villagePlaceSubmission.update({ where: { id: submission.id }, data: { approvedPlaceId: place.id } });
      const title = submission.type === "UPDATE" ? "คำขอแก้ไขสถานที่ของคุณได้รับการอนุมัติ" : "คำขอเพิ่มสถานที่ของคุณได้รับการอนุมัติ";
      await tx.notification.create({ data: { villageId: ctx.villageId, userId: submission.requesterId, type: NotificationType.SYSTEM, title, body: `สถานที่: ${payload.name}`, metadata: { submissionId: submission.id, placeId: place.id, status: "APPROVED", actionUrl: `/resident/places/${place.id}?from=notifications` } } });
      await tx.auditLog.create({ data: { userId: ctx.session.id, villageId: ctx.villageId, action: AuditAction.APPROVE, resource: "VillagePlaceSubmission", resourceId: submission.id, metadata: { actionName: "PLACE_REQUEST_APPROVED", requestType: submission.type, placeId: place.id, requesterId: submission.requesterId } } });
      return place;
    });
    await deletePlaceUploads(removedFileKeys);
    revalidatePlacePaths(result.id, submissionId);
    return { success: true, placeId: result.id };
  } catch (error) {
    if (error instanceof Error && error.message === "PLACE_TARGET_NOT_FOUND") return { success: false, error: "ไม่พบสถานที่ปลายทางสำหรับคำขอนี้" };
    if (error instanceof Error && error.message === "คำขอนี้ถูกดำเนินการแล้ว") return { success: false, error: "คำขอนี้ถูกดำเนินการแล้ว" };
    console.error("approve village place submission", error);
    return { success: false, error: "ไม่สามารถอนุมัติคำขอได้ กรุณาลองใหม่อีกครั้ง" };
  }
}

export async function adminRejectVillagePlaceSubmissionAction(submissionId: string, reviewNote: string): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const reason = reviewNote.trim();
  if (reason.length < 5) return { success: false, error: "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร" };
  const submission = await findPendingSubmission(submissionId, ctx.villageId);
  if (!submission) return { success: false, error: "ไม่พบคำขอนี้หรือคำขอถูกดำเนินการแล้ว" };
  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.villagePlaceSubmission.updateMany({ where: { id: submission.id, villageId: ctx.villageId, status: "PENDING" }, data: { status: "REJECTED", reviewedBy: ctx.session.id, reviewedAt: new Date(), reviewNote: reason } });
      if (claimed.count !== 1) throw new Error("คำขอนี้ถูกดำเนินการแล้ว");
      const title = submission.type === "UPDATE" ? "คำขอแก้ไขสถานที่ของคุณไม่ได้รับการอนุมัติ" : "คำขอเพิ่มสถานที่ของคุณไม่ได้รับการอนุมัติ";
      await tx.notification.create({ data: { villageId: ctx.villageId, userId: submission.requesterId, type: NotificationType.SYSTEM, title, body: reason, metadata: { submissionId: submission.id, status: "REJECTED", actionUrl: `/resident/places/requests/${submission.id}?from=notifications` } } });
      await tx.auditLog.create({ data: { userId: ctx.session.id, villageId: ctx.villageId, action: AuditAction.REJECT, resource: "VillagePlaceSubmission", resourceId: submission.id, metadata: { actionName: "PLACE_REQUEST_REJECTED", requestType: submission.type, requesterId: submission.requesterId, rejectReason: reason } } });
    });
    revalidatePlacePaths(undefined, submissionId);
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "คำขอนี้ถูกดำเนินการแล้ว") return { success: false, error: "คำขอนี้ถูกดำเนินการแล้ว" };
    console.error("reject village place submission", error);
    return { success: false, error: "ไม่สามารถบันทึกการไม่อนุมัติได้ กรุณาลองใหม่อีกครั้ง" };
  }
}

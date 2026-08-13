"use server";

import { AuditAction, NotificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { revalidateAdminSidebar } from "@/lib/revalidate-admin-sidebar";
import { getAdminMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { normalizeVillagePlaceInput, parseVillagePlacePayload } from "@/lib/village-place";

type PlaceInput = {
  name: string; category: string; description?: string; address?: string; openingHours?: string;
  contactPhone?: string; mapUrl?: string; latitude?: number | string | null; longitude?: number | string | null;
  isPublic?: boolean; isFeatured?: boolean; imageUrls?: string[];
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
  ["/admin/places", "/admin/places/requests", "/resident/places", "/resident/places/requests", ...(placeId ? [`/admin/places/${placeId}`, `/resident/places/${placeId}`] : []), ...(requestId ? [`/admin/places/requests/${requestId}`] : [])].forEach((path) => revalidatePath(path));
  revalidateAdminSidebar();
}

export async function adminCreateVillagePlaceAction(data: PlaceInput): Promise<{ success: true; placeId: string } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const normalized = normalizeVillagePlaceInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };
  const place = await prisma.$transaction(async (tx) => {
    const created = await tx.villagePlace.create({ data: { villageId: ctx.villageId, ...normalized.value, isFeatured: Boolean(data.isFeatured), description: normalized.value.description || null, address: normalized.value.address || null, openingHours: normalized.value.openingHours || null, contactPhone: normalized.value.contactPhone || null, mapUrl: normalized.value.mapUrl || null, createdById: ctx.session.id }, select: { id: true, name: true } });
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
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.villagePlace.findFirst({ where: { id: placeId, villageId: ctx.villageId }, select: { id: true, name: true, isPublic: true, isFeatured: true } });
    if (!existing) return false;
    const updated = await tx.villagePlace.update({ where: { id: placeId }, data: { ...normalized.value, isFeatured: Boolean(data.isFeatured), description: normalized.value.description || null, address: normalized.value.address || null, openingHours: normalized.value.openingHours || null, contactPhone: normalized.value.contactPhone || null, mapUrl: normalized.value.mapUrl || null }, select: { id: true, name: true, isPublic: true, isFeatured: true } });
    await tx.auditLog.create({ data: { userId: ctx.session.id, villageId: ctx.villageId, action: AuditAction.UPDATE, resource: "VillagePlace", resourceId: placeId, metadata: { actionName: "PLACE_UPDATED", oldValue: { name: existing.name, isPublic: existing.isPublic, isFeatured: existing.isFeatured }, newValue: { name: updated.name, isPublic: updated.isPublic, isFeatured: updated.isFeatured } } } });
    return true;
  });
  if (!result) return { success: false, error: "ไม่พบสถานที่ที่ต้องการแก้ไข" };
  revalidatePlacePaths(placeId);
  return { success: true };
}

export async function adminDeleteVillagePlaceAction(placeId: string): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.villagePlace.findFirst({ where: { id: placeId, villageId: ctx.villageId }, select: { id: true, name: true } });
    if (!existing) return false;
    await tx.villagePlace.delete({ where: { id: placeId } });
    await tx.auditLog.create({ data: { userId: ctx.session.id, villageId: ctx.villageId, action: AuditAction.DELETE, resource: "VillagePlace", resourceId: placeId, metadata: { actionName: "PLACE_DELETED", name: existing.name } } });
    return true;
  });
  if (!result) return { success: false, error: "ไม่พบสถานที่ที่ต้องการลบ" };
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
    const result = await prisma.$transaction(async (tx) => {
      // The conditional state transition is the claim: only one admin can proceed.
      const claimed = await tx.villagePlaceSubmission.updateMany({ where: { id: submission.id, villageId: ctx.villageId, status: "PENDING" }, data: { status: "APPROVED", reviewedBy: ctx.session.id, reviewedAt: new Date(), reviewNote: null } });
      if (claimed.count !== 1) throw new Error("คำขอนี้ถูกดำเนินการแล้ว");
      let place;
      if (submission.type === "UPDATE") {
        if (!submission.targetPlaceId) throw new Error("คำขอแก้ไขไม่มีสถานที่ปลายทาง");
        const target = await tx.villagePlace.findFirst({ where: { id: submission.targetPlaceId, villageId: ctx.villageId }, select: { id: true } });
        if (!target) throw new Error("ไม่พบสถานที่ปลายทางสำหรับคำขอนี้");
        // Resident submissions never control the featured flag.
        place = await tx.villagePlace.update({ where: { id: target.id }, data: { ...payload, description: payload.description || null, address: payload.address || null, openingHours: payload.openingHours || null, contactPhone: payload.contactPhone || null, mapUrl: payload.mapUrl || null }, select: { id: true } });
      } else {
        place = await tx.villagePlace.create({ data: { villageId: ctx.villageId, ...payload, description: payload.description || null, address: payload.address || null, openingHours: payload.openingHours || null, contactPhone: payload.contactPhone || null, mapUrl: payload.mapUrl || null, isFeatured: false, createdById: submission.requesterId }, select: { id: true } });
      }
      const title = submission.type === "UPDATE" ? "คำขอแก้ไขสถานที่ของคุณได้รับการอนุมัติ" : "คำขอเพิ่มสถานที่ของคุณได้รับการอนุมัติ";
      await tx.notification.create({ data: { villageId: ctx.villageId, userId: submission.requesterId, type: NotificationType.SYSTEM, title, body: `สถานที่: ${payload.name}`, metadata: { submissionId: submission.id, placeId: place.id, status: "APPROVED", actionUrl: `/resident/places/${place.id}?from=notifications` } } });
      await tx.auditLog.create({ data: { userId: ctx.session.id, villageId: ctx.villageId, action: AuditAction.APPROVE, resource: "VillagePlaceSubmission", resourceId: submission.id, metadata: { actionName: "PLACE_REQUEST_APPROVED", requestType: submission.type, placeId: place.id, requesterId: submission.requesterId } } });
      return place;
    });
    revalidatePlacePaths(result.id, submissionId);
    return { success: true, placeId: result.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "ไม่สามารถอนุมัติคำขอได้" };
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
      await tx.notification.create({ data: { villageId: ctx.villageId, userId: submission.requesterId, type: NotificationType.SYSTEM, title, body: reason, metadata: { submissionId: submission.id, status: "REJECTED", actionUrl: "/resident/places/requests?from=notifications" } } });
      await tx.auditLog.create({ data: { userId: ctx.session.id, villageId: ctx.villageId, action: AuditAction.REJECT, resource: "VillagePlaceSubmission", resourceId: submission.id, metadata: { actionName: "PLACE_REQUEST_REJECTED", requestType: submission.type, requesterId: submission.requesterId, rejectReason: reason } } });
    });
    revalidatePlacePaths(undefined, submissionId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "ไม่สามารถบันทึกการไม่อนุมัติได้" };
  }
}

"use server";

import { AuditAction, NotificationStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

type RequestPayload = { name: string; role: string | null; phone: string; email: string | null; address: string | null; category: string | null; note: string | null };
type ActionResult = { success: boolean; already?: boolean; message: string; approvedContactId?: string };

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function payloadFrom(value: unknown): RequestPayload | null {
  const input = objectValue(value);
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  if (!name || !phone) return null;
  const optional = (key: string) => typeof input[key] === "string" && input[key].trim() ? input[key].trim() : null;
  return { name, phone, role: optional("role"), email: optional("email"), address: optional("address"), category: optional("category"), note: optional("note") };
}

async function requireAdminContext() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id || !isAdminUser(session)) return null;
  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE", role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] } },
    select: { villageId: true },
  });
  return membership ? { session, villageId: membership.villageId } : null;
}

async function syncTrackingNotification(tx: Prisma.TransactionClient, request: {
  id: string; villageId: string; requesterId: string; status: "APPROVED" | "REJECTED"; reviewedById: string; reviewedByName: string | null; reviewedAt: Date; rejectReason?: string | null; approvedContactId?: string | null;
}) {
  const tracking = await tx.notification.findFirst({
    where: { villageId: request.villageId, userId: request.requesterId, metadata: { path: ["source"], equals: "RESIDENT_CONTACT_REQUEST_TRACKING" }, AND: [{ metadata: { path: ["requestId"], equals: request.id } }] },
    select: { id: true, metadata: true },
  });
  if (!tracking) return;
  const metadata = objectValue(tracking.metadata);
  await tx.notification.update({
    where: { id: tracking.id },
    data: {
      status: NotificationStatus.READ,
      readAt: request.reviewedAt,
      metadata: {
        ...metadata,
        source: "RESIDENT_CONTACT_REQUEST_TRACKING",
        workflowStatus: request.status,
        reviewedById: request.reviewedById,
        reviewedByName: request.reviewedByName,
        reviewedAt: request.reviewedAt.toISOString(),
        ...(request.status === "APPROVED" ? { approvedContactId: request.approvedContactId } : { rejectReason: request.rejectReason }),
      } as Prisma.InputJsonValue,
    },
  });
}

async function archiveReviewNotifications(tx: Prisma.TransactionClient, villageId: string, requestId: string, reviewedAt: Date) {
  await tx.notification.updateMany({
    where: { villageId, metadata: { path: ["source"], equals: "RESIDENT_CONTACT_REQUEST_REVIEW" }, AND: [{ metadata: { path: ["requestId"], equals: requestId } }] },
    data: { status: NotificationStatus.ARCHIVED, readAt: reviewedAt },
  });
}

// Converts a valid pre-migration tracking notification only when it is acted on.
// The unique request id makes this safe even if two administrators race to migrate it.
async function materializeLegacyRequest(tx: Prisma.TransactionClient, requestId: string, villageId: string) {
  const tracking = await tx.notification.findFirst({
    where: { villageId, metadata: { path: ["source"], equals: "RESIDENT_CONTACT_REQUEST_TRACKING" }, AND: [{ metadata: { path: ["requestId"], equals: requestId } }] },
    select: { userId: true, createdAt: true, metadata: true },
  });
  if (!tracking) return null;
  const metadata = objectValue(tracking.metadata);
  const payload = payloadFrom(metadata.payload);
  const status = metadata.workflowStatus === "APPROVED" || metadata.workflowStatus === "REJECTED" ? metadata.workflowStatus : "PENDING";
  if (!payload) return null;
  return tx.contactRequest.upsert({
    where: { id: requestId },
    create: {
      id: requestId, villageId, requesterId: tracking.userId, ...payload, status,
      reviewedById: typeof metadata.reviewedById === "string" ? metadata.reviewedById : null,
      reviewedByName: typeof metadata.reviewedByName === "string" ? metadata.reviewedByName : null,
      reviewedAt: typeof metadata.reviewedAt === "string" ? new Date(metadata.reviewedAt) : null,
      rejectReason: typeof metadata.rejectReason === "string" ? metadata.rejectReason : null,
      approvedContactId: typeof metadata.approvedContactId === "string" ? metadata.approvedContactId : null,
      createdAt: tracking.createdAt,
    },
    update: {},
  });
}

async function runSerializable<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034" || attempt === 2) throw error;
    }
  }
  throw new Error("Unable to complete transaction");
}

function revalidateRequestPaths(requestId: string) {
  ["/admin", "/admin/contacts", "/admin/contacts/requests", `/admin/contacts/requests/${requestId}`, "/resident/contacts", "/resident/contacts/requests", `/resident/contacts/requests/${requestId}`].forEach((path) => revalidatePath(path));
}

export async function approveResidentContactRequestAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireAdminContext();
  const requestId = readText(formData, "requestId");
  if (!ctx) return { success: false, message: "ไม่มีสิทธิ์ดำเนินการคำขอนี้" };
  if (!requestId) return { success: false, message: "ไม่พบคำขอ" };

  try {
    const result = await runSerializable(async (tx) => {
      let request = await tx.contactRequest.findFirst({ where: { id: requestId, villageId: ctx.villageId } });
      if (!request) request = await materializeLegacyRequest(tx, requestId, ctx.villageId);
      if (!request || request.villageId !== ctx.villageId) return { success: false, message: "ไม่พบคำขอหรือข้อมูลคำขอไม่ถูกต้อง" } as ActionResult;
      if (request.status === "APPROVED") return { success: true, already: true, message: "คำขอนี้ได้รับการอนุมัติแล้ว", approvedContactId: request.approvedContactId ?? undefined };
      if (request.status === "REJECTED") return { success: true, already: true, message: "คำขอนี้ได้รับการพิจารณาแล้ว" };

      const reviewedAt = new Date();
      const claimed = await tx.contactRequest.updateMany({
        where: { id: request.id, villageId: ctx.villageId, status: "PENDING" },
        data: { status: "APPROVED", reviewedById: ctx.session.id, reviewedByName: ctx.session.name ?? null, reviewedAt },
      });
      if (claimed.count !== 1) return { success: true, already: true, message: "คำขอนี้ได้รับการพิจารณาแล้ว" };

      const contact = await tx.contactDirectory.create({ data: { villageId: ctx.villageId, name: request.name, role: request.role, phone: request.phone, email: request.email, address: request.address, category: request.category, isPublic: false, sortOrder: 0 }, select: { id: true } });
      await tx.contactRequest.update({ where: { id: request.id }, data: { approvedContactId: contact.id } });
      await syncTrackingNotification(tx, { ...request, status: "APPROVED", reviewedById: ctx.session.id, reviewedByName: ctx.session.name ?? null, reviewedAt, approvedContactId: contact.id });
      await archiveReviewNotifications(tx, ctx.villageId, request.id, reviewedAt);
      await tx.auditLog.create({ data: { userId: ctx.session.id, villageId: ctx.villageId, action: AuditAction.APPROVE, resource: "ContactRequest", resourceId: request.id, metadata: { actionName: "CONTACT_REQUEST_APPROVED", requestId: request.id, contactId: contact.id, requesterId: request.requesterId, reviewerId: ctx.session.id } } });
      return { success: true, message: "อนุมัติคำขอและเพิ่มผู้ติดต่อเรียบร้อยแล้ว", approvedContactId: contact.id };
    });
    revalidateRequestPaths(requestId);
    return result;
  } catch (error) {
    console.error("approve contact request", error);
    return { success: false, message: "ไม่สามารถอนุมัติคำขอได้ กรุณาลองอีกครั้ง" };
  }
}

export async function rejectResidentContactRequestAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireAdminContext();
  const requestId = readText(formData, "requestId");
  const reason = readText(formData, "reason");
  if (!ctx) return { success: false, message: "ไม่มีสิทธิ์ดำเนินการคำขอนี้" };
  if (!requestId) return { success: false, message: "ไม่พบคำขอ" };
  if (reason.length < 5) return { success: false, message: "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร" };

  try {
    const result = await runSerializable(async (tx) => {
      let request = await tx.contactRequest.findFirst({ where: { id: requestId, villageId: ctx.villageId } });
      if (!request) request = await materializeLegacyRequest(tx, requestId, ctx.villageId);
      if (!request || request.villageId !== ctx.villageId) return { success: false, message: "ไม่พบคำขอหรือข้อมูลคำขอไม่ถูกต้อง" } as ActionResult;
      if (request.status !== "PENDING") return { success: true, already: true, message: request.status === "APPROVED" ? "คำขอนี้ได้รับการอนุมัติแล้ว" : "คำขอนี้ได้รับการพิจารณาแล้ว" };

      const reviewedAt = new Date();
      const claimed = await tx.contactRequest.updateMany({ where: { id: request.id, villageId: ctx.villageId, status: "PENDING" }, data: { status: "REJECTED", reviewedById: ctx.session.id, reviewedByName: ctx.session.name ?? null, reviewedAt, rejectReason: reason } });
      if (claimed.count !== 1) return { success: true, already: true, message: "คำขอนี้ได้รับการพิจารณาแล้ว" };
      await syncTrackingNotification(tx, { ...request, status: "REJECTED", reviewedById: ctx.session.id, reviewedByName: ctx.session.name ?? null, reviewedAt, rejectReason: reason });
      await archiveReviewNotifications(tx, ctx.villageId, request.id, reviewedAt);
      await tx.auditLog.create({ data: { userId: ctx.session.id, villageId: ctx.villageId, action: AuditAction.REJECT, resource: "ContactRequest", resourceId: request.id, metadata: { actionName: "CONTACT_REQUEST_REJECTED", requestId: request.id, requesterId: request.requesterId, reviewerId: ctx.session.id, rejectReason: reason } } });
      return { success: true, message: "บันทึกการไม่อนุมัติเรียบร้อยแล้ว" };
    });
    revalidateRequestPaths(requestId);
    return result;
  } catch (error) {
    console.error("reject contact request", error);
    return { success: false, message: "ไม่สามารถบันทึกการไม่อนุมัติได้ กรุณาลองอีกครั้ง" };
  }
}

"use server";

import { AuditAction, ContactRequestType, NotificationStatus, NotificationType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { getNextContactSortOrder } from "@/features/contact-ordering/server/order";

type RequestPayload = { name: string; role: string | null; phone: string; email: string | null; address: string | null; category: string | null; note: string | null };
type ActionResult = { success: boolean; already?: boolean; message: string; approvedContactId?: string };
type ContactSnapshot = { name: string; role: string | null; phone: string; email: string | null; address: string | null; category: string | null };

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

function contactSnapshot(value: unknown): ContactSnapshot | null {
  const input = objectValue(value);
  if (typeof input.name !== "string" || typeof input.phone !== "string") return null;
  const optional = (key: string) => typeof input[key] === "string" && input[key].trim() ? input[key].trim() : null;
  return { name: input.name.trim(), phone: input.phone.trim(), role: optional("role"), email: optional("email"), address: optional("address"), category: optional("category") };
}

function snapshotMatchesContact(snapshot: ContactSnapshot, contact: { name: string; role: string | null; phone: string | null; email: string | null; address: string | null; category: string | null }) {
  return snapshot.name === contact.name && snapshot.role === contact.role && snapshot.phone === (contact.phone ?? "") && snapshot.email === contact.email && snapshot.address === contact.address && snapshot.category === contact.category;
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

function getResidentCreateSource(
  tx: Prisma.TransactionClient,
  villageId: string,
  requesterId: string,
  contactId: string,
) {
  return tx.contactRequest.findFirst({
    where: {
      villageId,
      requesterId,
      type: ContactRequestType.CREATE,
      status: "APPROVED",
      approvedContactId: contactId,
    },
    select: { id: true },
  });
}

async function createReviewResultNotification(tx: Prisma.TransactionClient, request: {
  id: string; villageId: string; requesterId: string; name: string; type: ContactRequestType; targetContactId: string | null; status: "APPROVED" | "REJECTED"; rejectReason?: string | null; approvedContactId?: string | null;
}) {
  const eventKey = `CONTACT_REQUEST_RESULT:${request.id}:${request.status}`;
  const existing = await tx.notification.findFirst({
    where: { villageId: request.villageId, userId: request.requesterId, metadata: { path: ["eventKey"], equals: eventKey } },
    select: { id: true },
  });
  if (existing) return;

  const isUpdate = request.type === ContactRequestType.UPDATE;
  const isDelete = request.type === ContactRequestType.DELETE;
  const contactId = request.status === "APPROVED" ? request.approvedContactId : request.targetContactId;
  const actionUrl = isDelete
    ? `/resident/contacts/requests/${request.id}`
    : request.status === "APPROVED" && contactId
    ? `/resident/contacts/${contactId}`
    : `/resident/contacts/requests/${request.id}`;
  const title = request.status === "APPROVED"
    ? (isDelete ? "คำขอลบผู้ติดต่อได้รับการอนุมัติ" : isUpdate ? "คำขอแก้ไขผู้ติดต่อได้รับการอนุมัติ" : "คำขอเพิ่มผู้ติดต่อได้รับการอนุมัติ")
    : (isDelete ? "คำขอลบผู้ติดต่อไม่ได้รับการอนุมัติ" : isUpdate ? "คำขอแก้ไขผู้ติดต่อไม่ได้รับการอนุมัติ" : "คำขอเพิ่มผู้ติดต่อไม่ได้รับการอนุมัติ");
  const body = request.status === "APPROVED"
    ? (isDelete ? `“${request.name}” ถูกนำออกจากรายชื่อผู้ติดต่อแล้ว` : isUpdate ? `ข้อมูล “${request.name}” ได้รับการอัปเดตแล้ว` : `“${request.name}” ถูกเพิ่มเข้ารายชื่อผู้ติดต่อแล้ว`)
    : `เหตุผล: ${(request.rejectReason?.trim() || "ไม่ระบุเหตุผล").slice(0, 300)}`;
  await tx.notification.create({
    data: {
      userId: request.requesterId,
      villageId: request.villageId,
      type: NotificationType.SYSTEM,
      title,
      body,
      metadata: {
        source: "CONTACT",
        eventKey,
        requestId: request.id,
        requestType: request.type,
        workflowEvent: isDelete ? (request.status === "APPROVED" ? "CONTACT_DELETE_APPROVED" : "CONTACT_DELETE_REJECTED") : "CONTACT_REQUEST_REVIEWED",
        workflowStatus: request.status,
        ...(request.status === "APPROVED" ? { approvedContactId: request.approvedContactId, targetContactId: request.targetContactId } : { targetContactId: request.targetContactId }),
        actionUrl,
      } as Prisma.InputJsonValue,
    },
  });
}

async function archiveReviewNotifications(tx: Prisma.TransactionClient, villageId: string, requestId: string, reviewedAt: Date) {
  await tx.notification.updateMany({
    where: { villageId, metadata: { path: ["source"], equals: "CONTACT" }, AND: [{ metadata: { path: ["requestId"], equals: requestId } }] },
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

function revalidateRequestPaths(requestId: string, contactId?: string | null) {
  ["/admin/contacts", "/admin/contacts/requests", `/admin/contacts/requests/${requestId}`, "/admin/notifications", "/resident/contacts", "/resident/contacts/requests", `/resident/contacts/requests/${requestId}`, "/resident/notifications", "/resident/saved", ...(contactId ? [`/admin/contacts/${contactId}`, `/resident/contacts/${contactId}`] : [])].forEach((path) => revalidatePath(path));
  revalidatePath("/admin", "layout");
  revalidatePath("/resident", "layout");
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
      if (request.status !== "PENDING") return { success: true, already: true, message: request.status === "CANCELLED" ? "คำขอนี้ถูกยกเลิกแล้ว" : "คำขอนี้ได้รับการพิจารณาแล้ว" };

      if (request.type === ContactRequestType.DELETE) {
        if (!request.targetContactId) return { success: false, message: "คำขอลบไม่มีข้อมูลผู้ติดต่อปลายทาง" } as ActionResult;
        const source = await getResidentCreateSource(tx, ctx.villageId, request.requesterId, request.targetContactId);
        if (!source) return { success: false, message: "ผู้ส่งคำขอไม่มีสิทธิ์ขอลบผู้ติดต่อนี้" } as ActionResult;
        const target = await tx.contactDirectory.findFirst({ where: { id: request.targetContactId, villageId: ctx.villageId }, select: { id: true, name: true } });
        if (!target) return { success: false, message: "ไม่พบผู้ติดต่อปลายทาง หรืออยู่คนละหมู่บ้าน" } as ActionResult;
        const reviewedAt = new Date();
        const claimed = await tx.contactRequest.updateMany({ where: { id: request.id, villageId: ctx.villageId, status: "PENDING" }, data: { status: "APPROVED", reviewedById: ctx.session.id, reviewedByName: ctx.session.name ?? null, reviewedAt } });
        if (claimed.count !== 1) return { success: true, already: true, message: "คำขอนี้ได้รับการพิจารณาแล้ว" };
        await tx.savedItem.deleteMany({ where: { contactId: target.id } });
        await tx.contactDirectory.delete({ where: { id: target.id } });
        await createReviewResultNotification(tx, { ...request, status: "APPROVED", approvedContactId: null });
        await archiveReviewNotifications(tx, ctx.villageId, request.id, reviewedAt);
        await tx.auditLog.create({ data: { userId: ctx.session.id, villageId: ctx.villageId, action: AuditAction.DELETE, resource: "ContactRequest", resourceId: request.id, metadata: { actionName: "CONTACT_DELETE_REQUEST_APPROVED", requestType: request.type, requestId: request.id, contactId: target.id, requesterId: request.requesterId, reviewerId: ctx.session.id, workflowEvent: "CONTACT_DELETE_APPROVED" } } });
        return { success: true, message: "อนุมัติคำขอลบผู้ติดต่อเรียบร้อยแล้ว", approvedContactId: target.id };
      }

      let targetContact: { id: string; name: string; role: string | null; phone: string | null; email: string | null; address: string | null; category: string | null } | null = null;
      if (request.type === ContactRequestType.UPDATE) {
        if (!request.targetContactId) return { success: false, message: "คำขอแก้ไขไม่มีข้อมูลผู้ติดต่อปลายทาง" } as ActionResult;
        const source = await getResidentCreateSource(tx, ctx.villageId, request.requesterId, request.targetContactId);
        if (!source) return { success: false, message: "ผู้ส่งคำขอไม่มีสิทธิ์แก้ไขข้อมูลผู้ติดต่อนี้" } as ActionResult;
        targetContact = await tx.contactDirectory.findFirst({ where: { id: request.targetContactId, villageId: ctx.villageId }, select: { id: true, name: true, role: true, phone: true, email: true, address: true, category: true } });
        if (!targetContact) return { success: false, message: "ไม่พบข้อมูลผู้ติดต่อปลายทาง หรืออยู่คนละหมู่บ้าน" } as ActionResult;
        const snapshot = contactSnapshot(request.targetSnapshot);
        if (!snapshot || !snapshotMatchesContact(snapshot, targetContact)) return { success: false, message: "ข้อมูลผู้ติดต่อถูกเปลี่ยนหลังส่งคำขอ กรุณาตรวจสอบและพิจารณาคำขอใหม่" } as ActionResult;
      }

      const reviewedAt = new Date();
      const claimed = await tx.contactRequest.updateMany({
        where: { id: request.id, villageId: ctx.villageId, status: "PENDING" },
        data: { status: "APPROVED", reviewedById: ctx.session.id, reviewedByName: ctx.session.name ?? null, reviewedAt },
      });
      if (claimed.count !== 1) return { success: true, already: true, message: "คำขอนี้ได้รับการพิจารณาแล้ว" };

      const approvedContactId = targetContact
        ? (await tx.contactDirectory.update({ where: { id: targetContact.id }, data: { name: request.name, role: request.role, phone: request.phone, email: request.email, address: request.address, category: request.category }, select: { id: true } })).id
        : (await tx.contactDirectory.create({ data: { villageId: ctx.villageId, name: request.name, role: request.role, phone: request.phone, email: request.email, address: request.address, category: request.category, isPublic: false, sortOrder: await getNextContactSortOrder(tx, ctx.villageId) }, select: { id: true } })).id;
      await tx.contactRequest.update({ where: { id: request.id }, data: { approvedContactId } });
      await createReviewResultNotification(tx, { ...request, status: "APPROVED", approvedContactId });
      await archiveReviewNotifications(tx, ctx.villageId, request.id, reviewedAt);
      await tx.auditLog.create({ data: { userId: ctx.session.id, villageId: ctx.villageId, action: AuditAction.APPROVE, resource: "ContactRequest", resourceId: request.id, metadata: { actionName: request.type === ContactRequestType.UPDATE ? "CONTACT_UPDATE_REQUEST_APPROVED" : "CONTACT_REQUEST_APPROVED", requestType: request.type, requestId: request.id, contactId: approvedContactId, requesterId: request.requesterId, reviewerId: ctx.session.id } } });
      return { success: true, message: request.type === ContactRequestType.UPDATE ? "อนุมัติคำขอแก้ไขผู้ติดต่อเรียบร้อยแล้ว" : "อนุมัติคำขอและเพิ่มผู้ติดต่อเรียบร้อยแล้ว", approvedContactId };
    });
    revalidateRequestPaths(requestId, result.approvedContactId);
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
      if (request.status !== "PENDING") return { success: true, already: true, message: request.status === "APPROVED" ? "คำขอนี้ได้รับการอนุมัติแล้ว" : request.status === "CANCELLED" ? "คำขอนี้ถูกยกเลิกแล้ว" : "คำขอนี้ได้รับการพิจารณาแล้ว" };

      const reviewedAt = new Date();
      const claimed = await tx.contactRequest.updateMany({ where: { id: request.id, villageId: ctx.villageId, status: "PENDING" }, data: { status: "REJECTED", reviewedById: ctx.session.id, reviewedByName: ctx.session.name ?? null, reviewedAt, rejectReason: reason } });
      if (claimed.count !== 1) return { success: true, already: true, message: "คำขอนี้ได้รับการพิจารณาแล้ว" };
      await createReviewResultNotification(tx, { ...request, status: "REJECTED", rejectReason: reason });
      await archiveReviewNotifications(tx, ctx.villageId, request.id, reviewedAt);
      await tx.auditLog.create({ data: { userId: ctx.session.id, villageId: ctx.villageId, action: AuditAction.REJECT, resource: "ContactRequest", resourceId: request.id, metadata: { actionName: request.type === ContactRequestType.DELETE ? "CONTACT_DELETE_REQUEST_REJECTED" : request.type === ContactRequestType.UPDATE ? "CONTACT_UPDATE_REQUEST_REJECTED" : "CONTACT_REQUEST_REJECTED", requestType: request.type, requestId: request.id, requesterId: request.requesterId, reviewerId: ctx.session.id, rejectReason: reason, workflowEvent: request.type === ContactRequestType.DELETE ? "CONTACT_DELETE_REJECTED" : undefined } } });
      return { success: true, message: "บันทึกการไม่อนุมัติเรียบร้อยแล้ว" };
    });
    revalidateRequestPaths(requestId);
    return result;
  } catch (error) {
    console.error("reject contact request", error);
    return { success: false, message: "ไม่สามารถบันทึกการไม่อนุมัติได้ กรุณาลองอีกครั้ง" };
  }
}

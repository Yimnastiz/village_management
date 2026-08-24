"use server";

import { randomUUID } from "crypto";
import { AuditAction, ContactRequestType, NotificationType, Prisma, VillageMembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { isContactCategory, validateContactEmail, validateContactPhone } from "@/lib/contact";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";

const ADMIN_ROLES: VillageMembershipRole[] = [
  VillageMembershipRole.HEADMAN,
  VillageMembershipRole.ASSISTANT_HEADMAN,
  VillageMembershipRole.COMMITTEE,
];

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export type ContactRequestField = "name" | "phone" | "email" | "category";
export type ContactRequestResult =
  | { success: true; requestId: string }
  | { success: false; error: string; field?: ContactRequestField };

async function createContactRequestNotifications(
  tx: Prisma.TransactionClient,
  input: { requestId: string; villageId: string; requesterId: string; requesterName: string | null; contactName: string; requestType: ContactRequestType },
) {
  const isUpdate = input.requestType === ContactRequestType.UPDATE;
  await tx.notification.create({
    data: {
      userId: input.requesterId,
      villageId: input.villageId,
      type: NotificationType.SYSTEM,
      title: isUpdate ? "ส่งคำขอแก้ไขผู้ติดต่อแล้ว" : "ส่งคำขอเพิ่มผู้ติดต่อแล้ว",
      body: isUpdate ? "คำขอแก้ไขของคุณถูกส่งให้ผู้ดูแลหมู่บ้านตรวจสอบแล้ว" : "คำขอของคุณถูกส่งให้ผู้ดูแลหมู่บ้านตรวจสอบแล้ว",
      metadata: {
        source: "RESIDENT_CONTACT_REQUEST_SUBMITTED",
        requestId: input.requestId,
        requestType: input.requestType,
        workflowStatus: "PENDING",
        actionUrl: `/resident/contacts/requests/${input.requestId}`,
      },
    },
  });

  const admins = await tx.villageMembership.findMany({
    where: { villageId: input.villageId, status: "ACTIVE", role: { in: ADMIN_ROLES } },
    distinct: ["userId"],
    select: { userId: true },
  });
  if (!admins.length) return;
  await tx.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.userId,
      villageId: input.villageId,
      type: NotificationType.SYSTEM,
      title: isUpdate ? "มีคำขอแก้ไขผู้ติดต่อจากลูกบ้าน" : "มีคำขอเพิ่มผู้ติดต่อจากลูกบ้าน",
      body: `${input.requesterName || "ลูกบ้าน"} ส่งคำขอ${isUpdate ? "แก้ไข" : "เพิ่ม"}ผู้ติดต่อ “${input.contactName}”`,
      metadata: {
        source: "RESIDENT_CONTACT_REQUEST_REVIEW",
        requestId: input.requestId,
        requestType: input.requestType,
        workflowStatus: "PENDING",
        actionUrl: `/admin/contacts/requests/${input.requestId}`,
      },
    })),
  });
}

export async function createResidentContactRequestAction(formData: FormData): Promise<ContactRequestResult> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    return { success: false, error: "กรุณาเข้าสู่ระบบ" };
  }

  const membership = getResidentMembership(session);
  if (!membership) {
    return { success: false, error: "ไม่พบหมู่บ้านของคุณ" };
  }

  const name = readText(formData, "name");
  const role = readText(formData, "role");
  const phone = readText(formData, "phone");
  const email = readText(formData, "email");
  const address = readText(formData, "address");
  const category = readText(formData, "category");
  const note = readText(formData, "note");

  if (name.length < 2) {
    return { success: false, error: "กรุณาระบุชื่อผู้ติดต่ออย่างน้อย 2 ตัวอักษร", field: "name" };
  }
  const phoneError = validateContactPhone(phone);
  if (phoneError) {
    return { success: false, error: phoneError, field: "phone" };
  }
  if (!category) {
    return { success: false, error: "กรุณาเลือกหมวดหมู่", field: "category" };
  }
  if (!isContactCategory(category)) {
    return { success: false, error: "หมวดหมู่ผู้ติดต่อไม่ถูกต้อง", field: "category" };
  }
  const emailError = validateContactEmail(email);
  if (emailError) return { success: false, error: emailError, field: "email" };

  const requestId = randomUUID();

  const trackingNotification = await prisma.$transaction(async (tx) => {
    const request = await tx.contactRequest.create({
      data: {
        id: requestId,
        villageId: membership.villageId,
        requesterId: session.id,
        name,
        role: role || null,
        phone,
        email: email || null,
        address: address || null,
        category: category || null,
        note: note || null,
      },
    });

    await createContactRequestNotifications(tx, { requestId: request.id, villageId: membership.villageId, requesterId: session.id, requesterName: session.name, contactName: name, requestType: ContactRequestType.CREATE });
    return { requestId: request.id };
  });

  revalidateResidentContactRequest(trackingNotification.requestId);
  return { success: true, requestId: trackingNotification.requestId };
}

type ContactRequestValues = { name: string; role: string | null; phone: string; email: string | null; address: string | null; category: string | null; note: string | null };
type ContactSnapshot = Omit<ContactRequestValues, "note">;

function readContactRequestValues(formData: FormData): ContactRequestValues {
  const optional = (key: string) => readText(formData, key) || null;
  return { name: readText(formData, "name"), role: optional("role"), phone: readText(formData, "phone"), email: optional("email"), address: optional("address"), category: optional("category"), note: optional("note") };
}

function validateContactRequestValues(value: ContactRequestValues, allowedLegacyCategory?: string | null): Exclude<ContactRequestResult, { success: true }> | null {
  if (value.name.length < 2) return { success: false, error: "กรุณาระบุชื่อผู้ติดต่ออย่างน้อย 2 ตัวอักษร", field: "name" };
  const phoneError = validateContactPhone(value.phone);
  if (phoneError) return { success: false, error: phoneError, field: "phone" };
  const emailError = validateContactEmail(value.email ?? "");
  if (emailError) return { success: false, error: emailError, field: "email" };
  if (!value.category) return { success: false, error: "กรุณาเลือกหมวดหมู่", field: "category" };
  if (!isContactCategory(value.category) && value.category !== allowedLegacyCategory) return { success: false, error: "หมวดหมู่ผู้ติดต่อไม่ถูกต้อง", field: "category" };
  return null;
}

function snapshotFromContact(contact: { name: string; role: string | null; phone: string | null; email: string | null; address: string | null; category: string | null }): ContactSnapshot {
  return { name: contact.name, role: contact.role, phone: contact.phone ?? "", email: contact.email, address: contact.address, category: contact.category };
}

function snapshotFromJson(value: unknown): ContactSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.name !== "string" || typeof input.phone !== "string") return null;
  const optional = (key: string) => typeof input[key] === "string" && input[key].trim() ? input[key].trim() : null;
  return { name: input.name.trim(), phone: input.phone.trim(), role: optional("role"), email: optional("email"), address: optional("address"), category: optional("category") };
}

function proposedMatchesSnapshot(proposed: ContactRequestValues, snapshot: ContactSnapshot) {
  return proposed.name === snapshot.name && proposed.role === snapshot.role && proposed.phone === snapshot.phone && proposed.email === snapshot.email && proposed.address === snapshot.address && proposed.category === snapshot.category;
}

function revalidateResidentContactRequest(requestId: string, contactId?: string) {
  ["/resident/contacts", "/resident/contacts/requests", `/resident/contacts/requests/${requestId}`, "/resident/notifications", "/admin/contacts", "/admin/contacts/requests", `/admin/contacts/requests/${requestId}`, "/admin/notifications", ...(contactId ? [`/resident/contacts/${contactId}`, `/admin/contacts/${contactId}`] : [])].forEach((path) => revalidatePath(path));
  revalidatePath("/resident", "layout");
  revalidatePath("/admin", "layout");
}

async function residentContext() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { ok: false as const, error: "กรุณาเข้าสู่ระบบ" };
  const membership = getResidentMembership(session);
  if (!membership) return { ok: false as const, error: "ไม่พบสิทธิ์ลูกบ้าน" };
  return { ok: true as const, session, membership };
}

export async function updateResidentContactRequestAction(requestId: string, formData: FormData): Promise<ContactRequestResult> {
  const context = await residentContext();
  if (!context.ok) return { success: false, error: context.error };
  const value = readContactRequestValues(formData);
  const request = await prisma.contactRequest.findFirst({ where: { id: requestId, requesterId: context.session.id, villageId: context.membership.villageId, status: "PENDING" }, select: { id: true, type: true, targetContactId: true, category: true, targetSnapshot: true } });
  if (!request || ![ContactRequestType.CREATE, ContactRequestType.UPDATE].includes(request.type)) return { success: false, error: "คำขอนี้ไม่สามารถแก้ไขได้" };
  const snapshot = request.type === ContactRequestType.UPDATE ? snapshotFromJson(request.targetSnapshot) : null;
  const invalid = validateContactRequestValues(value, snapshot?.category ?? request.category);
  if (invalid) return invalid;
  if (request.type === ContactRequestType.UPDATE && snapshot && proposedMatchesSnapshot(value, snapshot)) return { success: false, error: "ไม่มีข้อมูลที่เปลี่ยนแปลง" };
  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.contactRequest.updateMany({ where: { id: request.id, requesterId: context.session.id, villageId: context.membership.villageId, status: "PENDING" }, data: value });
    if (claimed.count !== 1) return false;
    await tx.auditLog.create({ data: { userId: context.session.id, villageId: context.membership.villageId, action: AuditAction.UPDATE, resource: "ContactRequest", resourceId: request.id, metadata: { actionName: "RESIDENT_CONTACT_REQUEST_UPDATED", requestType: request.type } } });
    return true;
  });
  if (!updated) return { success: false, error: "คำขอนี้ไม่สามารถแก้ไขได้" };
  revalidateResidentContactRequest(request.id, request.targetContactId ?? undefined);
  return { success: true, requestId: request.id };
}

export async function createResidentContactUpdateRequestAction(contactId: string, formData: FormData): Promise<ContactRequestResult> {
  const context = await residentContext();
  if (!context.ok) return { success: false, error: context.error };
  const value = readContactRequestValues(formData);
  const contact = await prisma.contactDirectory.findFirst({ where: { id: contactId, villageId: context.membership.villageId }, select: { id: true, name: true, role: true, phone: true, email: true, address: true, category: true } });
  if (!contact) return { success: false, error: "ไม่พบข้อมูลผู้ติดต่อ" };
  const invalid = validateContactRequestValues(value, contact.category);
  if (invalid) return invalid;
  const source = await prisma.contactRequest.findFirst({ where: { villageId: context.membership.villageId, requesterId: context.session.id, type: ContactRequestType.CREATE, status: "APPROVED", approvedContactId: contact.id }, select: { id: true } });
  if (!source) return { success: false, error: "คุณไม่มีสิทธิ์ขอแก้ไขข้อมูลผู้ติดต่อนี้" };
  const snapshot = snapshotFromContact(contact);
  if (proposedMatchesSnapshot(value, snapshot)) return { success: false, error: "ไม่มีข้อมูลที่เปลี่ยนแปลง" };
  const duplicate = await prisma.contactRequest.findFirst({ where: { villageId: context.membership.villageId, requesterId: context.session.id, type: ContactRequestType.UPDATE, targetContactId: contact.id, status: "PENDING" }, select: { id: true } });
  if (duplicate) return { success: false, error: "มีคำขอแก้ไขข้อมูลนี้รอการพิจารณาอยู่แล้ว" };
  let created: { id: string };
  try {
    created = await prisma.$transaction(async (tx) => {
      const request = await tx.contactRequest.create({ data: { id: randomUUID(), villageId: context.membership.villageId, requesterId: context.session.id, type: ContactRequestType.UPDATE, targetContactId: contact.id, targetSnapshot: snapshot as Prisma.InputJsonValue, ...value }, select: { id: true } });
      await createContactRequestNotifications(tx, { requestId: request.id, villageId: context.membership.villageId, requesterId: context.session.id, requesterName: context.session.name, contactName: contact.name, requestType: ContactRequestType.UPDATE });
      await tx.auditLog.create({ data: { userId: context.session.id, villageId: context.membership.villageId, action: AuditAction.CREATE, resource: "ContactRequest", resourceId: request.id, metadata: { actionName: "RESIDENT_CONTACT_UPDATE_REQUESTED", requestType: "UPDATE", targetContactId: contact.id } } });
      return request;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { success: false, error: "มีคำขอแก้ไขข้อมูลนี้รอการพิจารณาอยู่แล้ว" };
    throw error;
  }
  revalidateResidentContactRequest(created.id, contact.id);
  return { success: true, requestId: created.id };
}

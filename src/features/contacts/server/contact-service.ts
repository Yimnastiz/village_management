import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";
import { isContactCategory, validateContactEmail, validateContactPhone } from "@/lib/contact";
import { prisma } from "@/lib/prisma";
import { getContactProvenance } from "@/features/contact-provenance/server/provenance";
import { getNextContactSortOrder } from "@/features/contact-ordering/server/order";
import type { VillageActorContext } from "@/features/village-public-content/server/context";

export type ContactInput = { name?: string; role?: string; phone?: string; email?: string; address?: string; category?: string; sortOrder?: string; isPublic?: string };
export type ContactUpdateInput = ContactInput | { isPublic: string };
type Result<T = undefined> = T extends undefined ? { success: true } | { success: false; error: string } : ({ success: true } & T) | { success: false; error: string };

const inputSchema = z.object({ name: z.string().trim().min(2), role: z.string().optional(), phone: z.string().optional(), email: z.string().optional(), address: z.string().optional(), category: z.string().trim().min(1), sortOrder: z.string().optional(), isPublic: z.enum(["PUBLIC", "RESIDENT"]) });

function normalize(input: ContactInput, legacyCategory?: string | null) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "ข้อมูลผู้ติดต่อไม่ถูกต้อง" };
  const phone = parsed.data.phone?.trim() ?? "";
  const email = parsed.data.email?.trim() ?? "";
  if (validateContactPhone(phone, false) || validateContactEmail(email)) return { ok: false as const, error: "เบอร์โทรศัพท์หรืออีเมลไม่ถูกต้อง" };
  if (!isContactCategory(parsed.data.category) && parsed.data.category !== legacyCategory) return { ok: false as const, error: "หมวดหมู่ผู้ติดต่อไม่ถูกต้อง" };
  return { ok: true as const, value: { name: parsed.data.name, role: parsed.data.role?.trim() || null, phone: phone || null, email: email || null, address: parsed.data.address?.trim() || null, category: parsed.data.category, isPublic: parsed.data.isPublic === "PUBLIC" } };
}

function audit(tx: Prisma.TransactionClient, context: VillageActorContext, action: AuditAction, actionName: string, resourceId: string, metadata: Record<string, unknown> = {}) {
  return tx.auditLog.create({ data: { userId: context.actorUserId, villageId: context.villageId, action, resource: "ContactDirectory", resourceId, metadata: { actorRole: "HEADMAN", actionName, ...metadata } } });
}

export async function createContact(context: VillageActorContext, input: ContactInput): Promise<Result<{ id: string }>> {
  const normalized = normalize(input);
  if (!normalized.ok) return { success: false, error: normalized.error };
  const created = await prisma.$transaction(async (tx) => {
    const sortOrder = await getNextContactSortOrder(tx, context.villageId);
    const contact = await tx.contactDirectory.create({ data: { villageId: context.villageId, sortOrder, ...normalized.value } });
    await audit(tx, context, AuditAction.CREATE, "ADMIN_CONTACT_CREATED", contact.id, { newValue: { name: contact.name, category: contact.category, isPublic: contact.isPublic } });
    return contact;
  });
  return { success: true, id: created.id };
}

export async function updateContact(context: VillageActorContext, id: string, input: ContactUpdateInput): Promise<Result> {
  const existing = await prisma.contactDirectory.findFirst({ where: { id, villageId: context.villageId }, select: { id: true, name: true, role: true, phone: true, email: true, address: true, category: true, isPublic: true } });
  if (!existing) return { success: false, error: "ไม่พบผู้ติดต่อหรือไม่มีสิทธิ์แก้ไข" };
  const provenance = await getContactProvenance(context.villageId, id);
  if (provenance.source === "RESIDENT_REQUESTED" && Object.keys(input).every((key) => key === "isPublic")) {
    if (input.isPublic !== "PUBLIC" && input.isPublic !== "RESIDENT") return { success: false, error: "การมองเห็นไม่ถูกต้อง" };
    const isPublic = input.isPublic === "PUBLIC";
    await prisma.$transaction(async (tx) => { await tx.contactDirectory.update({ where: { id }, data: { isPublic } }); await audit(tx, context, AuditAction.UPDATE, "ADMIN_RESIDENT_CONTACT_VISIBILITY_CHANGED", id, { changedFields: existing.isPublic === isPublic ? [] : ["isPublic"] }); });
    return { success: true };
  }
  if (provenance.source === "RESIDENT_REQUESTED") return { success: false, error: "ข้อมูลหลักของผู้ติดต่อนี้ต้องแก้ไขผ่านคำขอจากลูกบ้าน" };
  const normalized = normalize(input as ContactInput, existing.category);
  if (!normalized.ok) return { success: false, error: normalized.error };
  await prisma.$transaction(async (tx) => { await tx.contactDirectory.update({ where: { id }, data: normalized.value }); await audit(tx, context, AuditAction.UPDATE, "ADMIN_CONTACT_UPDATED", id, { oldValue: existing, newValue: normalized.value }); });
  return { success: true };
}

export async function deleteContact(context: VillageActorContext, id: string, reason?: string): Promise<Result> {
  const existing = await prisma.contactDirectory.findFirst({ where: { id, villageId: context.villageId }, select: { id: true, name: true } });
  if (!existing) return { success: false, error: "ไม่พบผู้ติดต่อหรือไม่มีสิทธิ์ลบ" };
  await prisma.$transaction(async (tx) => { await tx.savedItem.deleteMany({ where: { contactId: id } }); await tx.contactDirectory.delete({ where: { id } }); await audit(tx, context, AuditAction.DELETE, "ADMIN_CONTACT_DELETED", id, { oldValue: { name: existing.name }, reason: reason ?? null }); });
  return { success: true };
}

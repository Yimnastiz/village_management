"use server";

import { AuditAction, MembershipStatus, NewsVisibility, NotificationType, Prisma, TransparencyStage, VillageMembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notificationMetadata } from "@/lib/notification-copy";
import { getAdminMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { hasVillagePermission } from "@/lib/village-permissions";
import { ActionReasonError, requireActionReason } from "@/lib/sensitive-action-policy";

const transparencyInputSchema = z.object({
  title: z.string().min(3, "กรุณาระบุหัวข้อ"),
  description: z.string().optional(),
  category: z.string().optional(),
  amount: z.number().min(0, "จำนวนเงินต้องไม่น้อยกว่า 0").optional(),
  fiscalYear: z.string().optional(),
  visibility: z.string().min(1, "กรุณาเลือกการมองเห็น"),
});

export type TransparencyInput = z.infer<typeof transparencyInputSchema>;
const VALID_VISIBILITY: NewsVisibility[] = ["PUBLIC", "RESIDENT_ONLY"];
type ActionResult<T = undefined> = { success: true } & (T extends undefined ? object : T) | { success: false; error: string };

async function requireAdminVillage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { ok: false as const, error: "กรุณาเข้าสู่ระบบ" };
  const membership = getAdminMembership(session);
  if (!membership) return { ok: false as const, error: "ไม่พบสิทธิ์ผู้ดูแลหมู่บ้าน" };
  if (!hasVillagePermission(membership.role, "transparency.manage")) return { ok: false as const, error: "ไม่มีสิทธิ์จัดการข้อมูลความโปร่งใส" };
  return { ok: true as const, userId: session.id, villageId: membership.villageId, actorRole: membership.role };
}

function normalizeInput(data: TransparencyInput) {
  const parsed = transparencyInputSchema.safeParse(data);
  if (!parsed.success) return { ok: false as const, error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง" };
  const visibility = parsed.data.visibility as NewsVisibility;
  if (!VALID_VISIBILITY.includes(visibility)) return { ok: false as const, error: "การมองเห็นไม่ถูกต้อง" };
  return { ok: true as const, value: { title: parsed.data.title.trim(), description: parsed.data.description?.trim() || null, category: parsed.data.category?.trim() || null, amount: parsed.data.amount ?? null, fiscalYear: parsed.data.fiscalYear?.trim() || null, visibility } };
}

function revalidateTransparencyViews(recordId?: string) {
  revalidatePath("/admin/transparency");
  revalidatePath("/resident/transparency");
  revalidatePath("/resident/saved");
  revalidatePath("/[villageSlug]/transparency", "page");
  revalidatePath("/resident/notifications");
  if (recordId) {
    revalidatePath(`/admin/transparency/${recordId}`);
    revalidatePath(`/resident/transparency/${recordId}`);
    revalidatePath(`/[villageSlug]/transparency/${recordId}`, "page");
  }
}

async function createPublishNotifications(tx: Prisma.TransactionClient, villageId: string, actorUserId: string, transparencyId: string, title: string, category: string | null) {
  const recipients = await tx.villageMembership.findMany({
    where: { villageId, userId: { not: actorUserId }, status: MembershipStatus.ACTIVE, role: VillageMembershipRole.RESIDENT, houseId: { not: null } },
    select: { userId: true },
  });
  if (!recipients.length) return;
  await tx.notification.createMany({ data: recipients.map(({ userId }) => ({
    userId, villageId, type: NotificationType.SYSTEM,
    title: `ข้อมูลความโปร่งใสใหม่: ${title}`,
    body: category ? `หมวดหมู่: ${category}` : "มีข้อมูลความโปร่งใสใหม่ในหมู่บ้าน",
    metadata: notificationMetadata("TRANSPARENCY", { transparencyId }),
  })) });
}

export async function createTransparencyAction(data: TransparencyInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const normalized = normalizeInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };
  const created = await prisma.$transaction(async (tx) => {
    const record = await tx.transparencyRecord.create({ data: { villageId: ctx.villageId, ...normalized.value, stage: TransparencyStage.DRAFT } });
    await tx.auditLog.create({ data: { userId: ctx.userId, villageId: ctx.villageId, action: AuditAction.CREATE, resource: "TransparencyRecord", resourceId: record.id, metadata: { actionName: "TRANSPARENCY_CREATED", newValue: { title: record.title, category: record.category, visibility: record.visibility, stage: record.stage } } } });
    return record;
  });
  revalidateTransparencyViews(created.id);
  return { success: true, id: created.id };
}

export async function updateTransparencyAction(id: string, data: TransparencyInput): Promise<ActionResult> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const normalized = normalizeInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.transparencyRecord.findFirst({ where: { id, villageId: ctx.villageId } });
    if (!existing || existing.stage === TransparencyStage.ARCHIVED) return false;
    const updated = await tx.transparencyRecord.update({ where: { id }, data: normalized.value });
    await tx.auditLog.create({ data: { userId: ctx.userId, villageId: ctx.villageId, action: AuditAction.UPDATE, resource: "TransparencyRecord", resourceId: id, metadata: { actionName: "TRANSPARENCY_UPDATED", oldValue: { title: existing.title, category: existing.category, amount: existing.amount, fiscalYear: existing.fiscalYear, visibility: existing.visibility }, newValue: { title: updated.title, category: updated.category, amount: updated.amount, fiscalYear: updated.fiscalYear, visibility: updated.visibility } } } });
    return true;
  });
  if (!result) return { success: false, error: "ไม่พบรายการนี้หรือไม่มีสิทธิ์แก้ไข" };
  revalidateTransparencyViews(id);
  return { success: true };
}

export async function publishTransparencyAction(id: string): Promise<ActionResult> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.transparencyRecord.findFirst({ where: { id, villageId: ctx.villageId } });
    if (!record || record.stage !== TransparencyStage.DRAFT) return null;
    const published = await tx.transparencyRecord.update({ where: { id }, data: { stage: TransparencyStage.PUBLISHED, publishedAt: new Date() } });
    await tx.auditLog.create({ data: { userId: ctx.userId, villageId: ctx.villageId, action: AuditAction.UPDATE, resource: "TransparencyRecord", resourceId: id, metadata: { actionName: "TRANSPARENCY_PUBLISHED", oldValue: { stage: record.stage }, newValue: { stage: published.stage, publishedAt: published.publishedAt, visibility: published.visibility } } } });
    await createPublishNotifications(tx, ctx.villageId, ctx.userId, id, published.title, published.category);
    return published;
  });
  if (!result) return { success: false, error: "ไม่พบฉบับร่างนี้หรือรายการถูกเผยแพร่แล้ว" };
  revalidateTransparencyViews(id);
  return { success: true };
}

export async function archiveTransparencyAction(id: string, reasonInput: string): Promise<ActionResult> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };
  let reason: string;
  try { reason = requireActionReason("content.archive", reasonInput); }
  catch (error) { if (error instanceof ActionReasonError) return { success: false, error: "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร" }; throw error; }
  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.transparencyRecord.findFirst({ where: { id, villageId: ctx.villageId } });
    if (!record || record.stage !== TransparencyStage.PUBLISHED) return false;
    const archived = await tx.transparencyRecord.updateMany({ where: { id, villageId: ctx.villageId, stage: TransparencyStage.PUBLISHED }, data: { stage: TransparencyStage.ARCHIVED } });
    if (archived.count !== 1) return false;
    await tx.auditLog.create({ data: { userId: ctx.userId, villageId: ctx.villageId, action: AuditAction.UPDATE, resource: "TransparencyRecord", resourceId: id, metadata: { actorRole: ctx.actorRole, policyAction: "content.archive", reason, actionName: "TRANSPARENCY_ARCHIVED", oldValue: { stage: record.stage }, newValue: { stage: TransparencyStage.ARCHIVED } } } });
    return true;
  });
  if (!result) return { success: false, error: "ไม่พบรายการที่เผยแพร่นี้หรือรายการถูกเก็บถาวรแล้ว" };
  revalidateTransparencyViews(id);
  return { success: true };
}

/** Restores an archived record without changing its original publication date or visibility. */
export async function republishTransparencyAction(id: string): Promise<ActionResult> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.transparencyRecord.findFirst({ where: { id, villageId: ctx.villageId } });
    if (!record || record.stage !== TransparencyStage.ARCHIVED) return false;
    const republished = await tx.transparencyRecord.updateMany({
      where: { id, villageId: ctx.villageId, stage: TransparencyStage.ARCHIVED },
      data: { stage: TransparencyStage.PUBLISHED },
    });
    if (republished.count !== 1) return false;
    await tx.auditLog.create({ data: { userId: ctx.userId, villageId: ctx.villageId, action: AuditAction.UPDATE, resource: "TransparencyRecord", resourceId: id, metadata: { actionName: "TRANSPARENCY_REPUBLISHED", title: record.title, oldValue: { stage: record.stage }, newValue: { stage: TransparencyStage.PUBLISHED, visibility: record.visibility, publishedAt: record.publishedAt } } } });
    return true;
  });
  if (!result) return { success: false, error: "ไม่พบรายการที่จัดเก็บแล้ว หรือสถานะรายการถูกเปลี่ยนไปแล้ว" };
  // This is a visibility restore, not a new publication: do not notify residents again.
  revalidateTransparencyViews(id);
  return { success: true };
}

export async function deleteTransparencyAction(id: string, reasonInput: string): Promise<ActionResult> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };
  let reason: string;
  try { reason = requireActionReason("content.delete", reasonInput); }
  catch (error) { if (error instanceof ActionReasonError) return { success: false, error: "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร" }; throw error; }
  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.transparencyRecord.findFirst({ where: { id, villageId: ctx.villageId } });
    if (!record || record.stage !== TransparencyStage.DRAFT) return false;
    await tx.savedItem.deleteMany({ where: { transparencyId: id } });
    await tx.transparencyRecord.delete({ where: { id } });
    await tx.auditLog.create({ data: { userId: ctx.userId, villageId: ctx.villageId, action: AuditAction.DELETE, resource: "TransparencyRecord", resourceId: id, metadata: { actorRole: ctx.actorRole, policyAction: "content.delete", reason, actionName: "TRANSPARENCY_DRAFT_DELETED", oldValue: { title: record.title, stage: record.stage } } } });
    return true;
  });
  if (!result) return { success: false, error: "ลบได้เฉพาะฉบับร่างที่ยังไม่เคยเผยแพร่" };
  revalidateTransparencyViews(id);
  return { success: true };
}

import {
  AuditAction,
  NewsStage,
  NewsVisibility,
  Prisma,
  TransparencyStage,
  VillagePlaceCategory,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { areSafeImageSources } from "@/lib/image-input";
import { prisma } from "@/lib/prisma";
import { normalizeVillagePlaceInput } from "@/lib/village-place";
import { isContactCategory, validateContactPhone } from "@/lib/contact";
import type { VillageActorContext } from "./context";

type ActionResult<T = undefined> = T extends undefined
  ? { success: true } | { success: false; error: string }
  : { success: true } & T | { success: false; error: string };

const newsInputSchema = z.object({
  title: z.string().min(3, "กรุณาระบุหัวข้อข่าว"),
  summary: z.string().optional(),
  content: z.string().min(10, "กรุณาระบุเนื้อหาอย่างน้อย 10 ตัวอักษร"),
  imageUrls: z.array(z.string()).optional(),
  coverUrl: z.string().nullable().optional(),
  visibility: z.string().min(1),
  stage: z.string().min(1),
  isPinned: z.boolean().optional(),
});

export type NewsInput = z.input<typeof newsInputSchema>;

const contactInputSchema = z.object({
  name: z.string().min(2, "กรุณาระบุชื่อผู้ติดต่อ"),
  role: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  category: z.string().trim().min(1, "กรุณาเลือกหมวดหมู่"),
  sortOrder: z.string().optional(),
  isPublic: z.string().min(1),
});

export type ContactInput = z.input<typeof contactInputSchema>;

export type PlaceInput = {
  name?: string;
  category?: string;
  description?: string;
  address?: string;
  openingHours?: string;
  contactPhone?: string;
  mapUrl?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  isPublic?: boolean;
  imageUrls?: string[];
};

const eventInputSchema = z.object({
  title: z.string().min(3, "กรุณาระบุชื่อกิจกรรม"),
  description: z.string().optional(),
  location: z.string().optional(),
  startsAt: z.string().min(1, "กรุณาระบุวันเวลาเริ่ม"),
  endsAt: z.string().optional(),
  isPublic: z.string().min(1),
});

export type EventInput = z.input<typeof eventInputSchema>;

const transparencyInputSchema = z.object({
  title: z.string().min(3, "กรุณาระบุหัวข้อ"),
  description: z.string().optional(),
  category: z.string().optional(),
  amount: z.number().optional(),
  fiscalYear: z.string().optional(),
  stage: z.string().min(1),
  visibility: z.string().min(1),
});

export type TransparencyInput = z.input<typeof transparencyInputSchema>;

const VALID_NEWS_STAGES: NewsStage[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const VALID_TRANSPARENCY_STAGES: TransparencyStage[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const VALID_VISIBILITY: NewsVisibility[] = ["PUBLIC", "RESIDENT_ONLY"];

function firstZodError(error: z.ZodError) {
  const fieldErrors = Object.values(error.flatten().fieldErrors) as string[][];
  return fieldErrors[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง";
}

function normalizeNewsInput(data: NewsInput) {
  const parsed = newsInputSchema.safeParse(data);
  if (!parsed.success) return { ok: false as const, error: firstZodError(parsed.error) };

  const visibility = parsed.data.visibility as NewsVisibility;
  const stage = parsed.data.stage as NewsStage;
  if (!VALID_VISIBILITY.includes(visibility)) return { ok: false as const, error: "ประเภทการแสดงผลไม่ถูกต้อง" };
  if (!VALID_NEWS_STAGES.includes(stage)) return { ok: false as const, error: "สถานะข่าวไม่ถูกต้อง" };

  const imageUrls = (parsed.data.imageUrls ?? []).map((url) => url.trim()).filter(Boolean);
  if (!areSafeImageSources(imageUrls)) return { ok: false as const, error: "รูปภาพต้องเป็นไฟล์หรือ URL ที่ผ่าน validation" };

  return {
    ok: true as const,
    value: {
      title: parsed.data.title.trim(),
      summary: parsed.data.summary?.trim() || null,
      content: parsed.data.content.trim(),
      imageUrls,
      coverUrl: imageUrls.includes(parsed.data.coverUrl ?? "") ? parsed.data.coverUrl ?? null : imageUrls[0] ?? null,
      visibility,
      stage,
      isPinned: Boolean(parsed.data.isPinned),
    },
  };
}

function normalizeContactInput(data: ContactInput, allowedLegacyCategory?: string | null) {
  const parsed = contactInputSchema.safeParse(data);
  if (!parsed.success) return { ok: false as const, error: firstZodError(parsed.error) };

  const phone = parsed.data.phone?.trim() || "";
  const phoneError = validateContactPhone(phone, false);
  if (phoneError) return { ok: false as const, error: phoneError };
  const category = parsed.data.category.trim();
  if (!isContactCategory(category) && category !== allowedLegacyCategory) return { ok: false as const, error: "หมวดหมู่ผู้ติดต่อไม่ถูกต้อง" };
  if (parsed.data.isPublic !== "PUBLIC" && parsed.data.isPublic !== "RESIDENT") return { ok: false as const, error: "การมองเห็นไม่ถูกต้อง" };
  const sortOrderRaw = parsed.data.sortOrder?.trim();
  const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : undefined;
  if (sortOrder !== undefined && !Number.isFinite(sortOrder)) return { ok: false as const, error: "ลำดับการแสดงผลไม่ถูกต้อง" };

  return {
    ok: true as const,
    value: {
      name: parsed.data.name.trim(),
      role: parsed.data.role?.trim() || null,
      phone: phone || null,
      email: parsed.data.email?.trim() || null,
      address: parsed.data.address?.trim() || null,
      category,
      sortOrder,
      isPublic: parsed.data.isPublic === "PUBLIC",
    },
  };
}

function normalizeEventInput(data: EventInput) {
  const parsed = eventInputSchema.safeParse(data);
  if (!parsed.success) return { ok: false as const, error: firstZodError(parsed.error) };

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = parsed.data.endsAt?.trim() ? new Date(parsed.data.endsAt) : null;
  if (Number.isNaN(startsAt.getTime())) return { ok: false as const, error: "วันเวลาเริ่มไม่ถูกต้อง" };
  if (endsAt && Number.isNaN(endsAt.getTime())) return { ok: false as const, error: "วันเวลาสิ้นสุดไม่ถูกต้อง" };
  if (endsAt && endsAt < startsAt) return { ok: false as const, error: "วันเวลาสิ้นสุดต้องไม่ก่อนวันเวลาเริ่ม" };

  return {
    ok: true as const,
    value: {
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      location: parsed.data.location?.trim() || null,
      startsAt,
      endsAt,
      isPublic: parsed.data.isPublic === "PUBLIC",
    },
  };
}

function normalizeTransparencyInput(data: TransparencyInput) {
  const parsed = transparencyInputSchema.safeParse(data);
  if (!parsed.success) return { ok: false as const, error: firstZodError(parsed.error) };

  const stage = parsed.data.stage as TransparencyStage;
  const visibility = parsed.data.visibility as NewsVisibility;
  if (!VALID_TRANSPARENCY_STAGES.includes(stage)) return { ok: false as const, error: "สถานะไม่ถูกต้อง" };
  if (!VALID_VISIBILITY.includes(visibility)) return { ok: false as const, error: "การมองเห็นไม่ถูกต้อง" };

  return {
    ok: true as const,
    value: {
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      category: parsed.data.category?.trim() || null,
      amount: parsed.data.amount ?? null,
      fiscalYear: parsed.data.fiscalYear?.trim() || null,
      stage,
      visibility,
    },
  };
}

async function auditSuperAdmin(
  tx: Prisma.TransactionClient,
  context: VillageActorContext,
  input: {
    action: AuditAction;
    actionName: string;
    resource: string;
    resourceId: string;
    oldValue?: Prisma.InputJsonValue;
    newValue?: Prisma.InputJsonValue;
  }
) {
  if (context.actorRole !== "SUPERADMIN") return;
  await tx.auditLog.create({
    data: {
      userId: context.actorUserId,
      villageId: context.villageId,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      metadata: {
        actorRole: "SUPERADMIN",
        targetVillageId: context.villageId,
        actionName: input.actionName,
        supportReason: context.supportReason,
        oldValue: input.oldValue,
        newValue: input.newValue,
      },
    },
  });
}

function revalidateVillagePublicContent(context: VillageActorContext, module: string, resourceId?: string) {
  revalidatePath(`/superadmin/villages/${context.villageId}/${module}`);
  revalidatePath(`/admin/${module}`);
  if (context.villageSlug) {
    revalidatePath(`/${context.villageSlug}/${module}`);
    if (resourceId) revalidatePath(`/${context.villageSlug}/${module}/${resourceId}`);
  }
}

function withReason(context: VillageActorContext, supportReason?: string): VillageActorContext {
  return supportReason ? { ...context, supportReason } : context;
}

export async function createNews(context: VillageActorContext, input: NewsInput): Promise<ActionResult<{ newsId: string }>> {
  const normalized = normalizeNewsInput(input);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const ctx = withReason(context, context.supportReason);
  const now = new Date();
  const created = await prisma.$transaction(async (tx) => {
    const news = await tx.news.create({
      data: {
        villageId: ctx.villageId,
        title: normalized.value.title,
        summary: normalized.value.summary,
        content: normalized.value.content,
        imageUrls: normalized.value.imageUrls,
        coverUrl: normalized.value.coverUrl,
        visibility: normalized.value.visibility,
        stage: normalized.value.stage,
        isPinned: normalized.value.isPinned,
        authorId: ctx.actorUserId,
        publishedAt: normalized.value.stage === "PUBLISHED" ? now : null,
      },
      select: { id: true },
    });
    await auditSuperAdmin(tx, ctx, {
      action: AuditAction.CREATE,
      actionName: "SUPERADMIN_NEWS_CREATED",
      resource: "News",
      resourceId: news.id,
      newValue: { title: normalized.value.title, stage: normalized.value.stage, visibility: normalized.value.visibility },
    });
    return news;
  });

  revalidateVillagePublicContent(ctx, "news", created.id);
  return { success: true, newsId: created.id };
}

export async function updateNews(context: VillageActorContext, newsId: string, input: NewsInput): Promise<ActionResult> {
  const normalized = normalizeNewsInput(input);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const ctx = withReason(context, context.supportReason);
  const existing = await prisma.news.findFirst({
    where: { id: newsId, villageId: ctx.villageId },
    select: { id: true, title: true, stage: true, visibility: true, publishedAt: true },
  });
  if (!existing) return { success: false, error: "ไม่พบข่าวนี้หรือไม่มีสิทธิ์แก้ไข" };

  const shouldSetPublishedAt = normalized.value.stage === "PUBLISHED" && (existing.stage !== "PUBLISHED" || !existing.publishedAt);
  await prisma.$transaction(async (tx) => {
    await tx.news.update({
      where: { id: newsId },
      data: {
        title: normalized.value.title,
        summary: normalized.value.summary,
        content: normalized.value.content,
        imageUrls: normalized.value.imageUrls,
        coverUrl: normalized.value.coverUrl,
        visibility: normalized.value.visibility,
        stage: normalized.value.stage,
        isPinned: normalized.value.isPinned,
        publishedAt: shouldSetPublishedAt ? new Date() : existing.publishedAt,
      },
    });
    await auditSuperAdmin(tx, ctx, {
      action: AuditAction.UPDATE,
      actionName: existing.stage !== normalized.value.stage ? `SUPERADMIN_NEWS_${normalized.value.stage}` : "SUPERADMIN_NEWS_UPDATED",
      resource: "News",
      resourceId: newsId,
      oldValue: { title: existing.title, stage: existing.stage, visibility: existing.visibility },
      newValue: { title: normalized.value.title, stage: normalized.value.stage, visibility: normalized.value.visibility },
    });
  });

  revalidateVillagePublicContent(ctx, "news", newsId);
  return { success: true };
}

export async function deleteNews(context: VillageActorContext, newsId: string): Promise<ActionResult> {
  const existing = await prisma.news.findFirst({
    where: { id: newsId, villageId: context.villageId },
    select: { id: true, title: true, stage: true },
  });
  if (!existing) return { success: false, error: "ไม่พบข่าวนี้หรือไม่มีสิทธิ์ลบ" };

  await prisma.$transaction(async (tx) => {
    await tx.news.delete({ where: { id: newsId } });
    await auditSuperAdmin(tx, context, {
      action: AuditAction.DELETE,
      actionName: "SUPERADMIN_NEWS_DELETED",
      resource: "News",
      resourceId: newsId,
      oldValue: { title: existing.title, stage: existing.stage },
    });
  });
  revalidateVillagePublicContent(context, "news");
  return { success: true };
}

export async function createContact(context: VillageActorContext, input: ContactInput): Promise<ActionResult<{ id: string }>> {
  const normalized = normalizeContactInput(input);
  if (!normalized.ok) return { success: false, error: normalized.error };
  const created = await prisma.$transaction(async (tx) => {
    const lastSortOrder = await tx.contactDirectory.aggregate({ where: { villageId: context.villageId }, _max: { sortOrder: true } });
    const sortOrder = normalized.value.sortOrder ?? (lastSortOrder._max.sortOrder ?? -1) + 1;
    const contact = await tx.contactDirectory.create({ data: { villageId: context.villageId, ...normalized.value, sortOrder }, select: { id: true } });
    await auditSuperAdmin(tx, context, {
      action: AuditAction.CREATE,
      actionName: "SUPERADMIN_CONTACT_CREATED",
      resource: "ContactDirectory",
      resourceId: contact.id,
      newValue: { name: normalized.value.name, role: normalized.value.role, category: normalized.value.category, isPublic: normalized.value.isPublic },
    });
    return contact;
  });
  revalidateVillagePublicContent(context, "contacts", created.id);
  return { success: true, id: created.id };
}

export async function updateContact(context: VillageActorContext, id: string, input: ContactInput): Promise<ActionResult> {
  const existing = await prisma.contactDirectory.findFirst({
    where: { id, villageId: context.villageId },
    select: { id: true, name: true, role: true, category: true, isPublic: true, sortOrder: true },
  });
  if (!existing) return { success: false, error: "ไม่พบผู้ติดต่อหรือไม่มีสิทธิ์แก้ไข" };
  const normalized = normalizeContactInput(input, existing.category);
  if (!normalized.ok) return { success: false, error: normalized.error };
  await prisma.$transaction(async (tx) => {
    await tx.contactDirectory.update({ where: { id }, data: { ...normalized.value, ...(normalized.value.sortOrder === undefined ? {} : { sortOrder: normalized.value.sortOrder }) } });
    await auditSuperAdmin(tx, context, {
      action: AuditAction.UPDATE,
      actionName: existing.isPublic !== normalized.value.isPublic ? "SUPERADMIN_CONTACT_VISIBILITY_CHANGED" : "SUPERADMIN_CONTACT_UPDATED",
      resource: "ContactDirectory",
      resourceId: id,
      oldValue: existing,
      newValue: { name: normalized.value.name, role: normalized.value.role, category: normalized.value.category, isPublic: normalized.value.isPublic, sortOrder: normalized.value.sortOrder },
    });
  });
  revalidateVillagePublicContent(context, "contacts", id);
  return { success: true };
}

export async function deleteContact(context: VillageActorContext, id: string): Promise<ActionResult> {
  const existing = await prisma.contactDirectory.findFirst({ where: { id, villageId: context.villageId }, select: { id: true, name: true } });
  if (!existing) return { success: false, error: "ไม่พบผู้ติดต่อหรือไม่มีสิทธิ์ลบ" };
  await prisma.$transaction(async (tx) => {
    await tx.contactDirectory.delete({ where: { id } });
    await auditSuperAdmin(tx, context, { action: AuditAction.DELETE, actionName: "SUPERADMIN_CONTACT_DELETED", resource: "ContactDirectory", resourceId: id, oldValue: { name: existing.name } });
  });
  revalidateVillagePublicContent(context, "contacts");
  return { success: true };
}

export async function createPlace(context: VillageActorContext, input: PlaceInput): Promise<ActionResult<{ placeId: string }>> {
  const normalized = normalizeVillagePlaceInput(input);
  if (!normalized.ok) return { success: false, error: normalized.error };
  const category = normalized.value.category as VillagePlaceCategory;
  const created = await prisma.$transaction(async (tx) => {
    const { images: _images, ...fields } = normalized.value;
    const place = await tx.villagePlace.create({
      data: { villageId: context.villageId, ...fields, category, imageUrls: input.imageUrls ?? [], createdById: context.actorUserId },
      select: { id: true },
    });
    await auditSuperAdmin(tx, context, {
      action: AuditAction.CREATE,
      actionName: "SUPERADMIN_PLACE_CREATED",
      resource: "VillagePlace",
      resourceId: place.id,
      newValue: { name: normalized.value.name, category, isPublic: normalized.value.isPublic },
    });
    return place;
  });
  revalidateVillagePublicContent(context, "places", created.id);
  return { success: true, placeId: created.id };
}

export async function updatePlace(context: VillageActorContext, placeId: string, input: PlaceInput): Promise<ActionResult> {
  const normalized = normalizeVillagePlaceInput(input);
  if (!normalized.ok) return { success: false, error: normalized.error };
  const existing = await prisma.villagePlace.findFirst({
    where: { id: placeId, villageId: context.villageId },
    select: { id: true, name: true, category: true, isPublic: true },
  });
  if (!existing) return { success: false, error: "ไม่พบสถานที่หรือไม่มีสิทธิ์แก้ไข" };
  const category = normalized.value.category as VillagePlaceCategory;
  await prisma.$transaction(async (tx) => {
    const { images: _images, ...fields } = normalized.value;
    await tx.villagePlace.update({ where: { id: placeId }, data: { ...fields, category, imageUrls: input.imageUrls ?? [] } });
    await auditSuperAdmin(tx, context, {
      action: AuditAction.UPDATE,
      actionName: "SUPERADMIN_PLACE_UPDATED",
      resource: "VillagePlace",
      resourceId: placeId,
      oldValue: existing,
      newValue: { name: normalized.value.name, category, isPublic: normalized.value.isPublic },
    });
  });
  revalidateVillagePublicContent(context, "places", placeId);
  return { success: true };
}

export async function deletePlace(context: VillageActorContext, placeId: string): Promise<ActionResult> {
  const existing = await prisma.villagePlace.findFirst({ where: { id: placeId, villageId: context.villageId }, select: { id: true, name: true } });
  if (!existing) return { success: false, error: "ไม่พบสถานที่หรือไม่มีสิทธิ์ลบ" };
  await prisma.$transaction(async (tx) => {
    await tx.villagePlace.delete({ where: { id: placeId } });
    await auditSuperAdmin(tx, context, { action: AuditAction.DELETE, actionName: "SUPERADMIN_PLACE_DELETED", resource: "VillagePlace", resourceId: placeId, oldValue: { name: existing.name } });
  });
  revalidateVillagePublicContent(context, "places");
  return { success: true };
}

export async function createEvent(context: VillageActorContext, input: EventInput): Promise<ActionResult<{ id: string }>> {
  const normalized = normalizeEventInput(input);
  if (!normalized.ok) return { success: false, error: normalized.error };
  const created = await prisma.$transaction(async (tx) => {
    const event = await tx.villageEvent.create({ data: { villageId: context.villageId, createdById: context.actorUserId, ...normalized.value }, select: { id: true } });
    await auditSuperAdmin(tx, context, { action: AuditAction.CREATE, actionName: "SUPERADMIN_EVENT_CREATED", resource: "VillageEvent", resourceId: event.id, newValue: { title: normalized.value.title, startsAt: normalized.value.startsAt.toISOString(), isPublic: normalized.value.isPublic } });
    return event;
  });
  revalidateVillagePublicContent(context, "calendar", created.id);
  return { success: true, id: created.id };
}

export async function updateEvent(context: VillageActorContext, id: string, input: EventInput): Promise<ActionResult> {
  const normalized = normalizeEventInput(input);
  if (!normalized.ok) return { success: false, error: normalized.error };
  const existing = await prisma.villageEvent.findFirst({ where: { id, villageId: context.villageId }, select: { id: true, title: true, startsAt: true, isPublic: true } });
  if (!existing) return { success: false, error: "ไม่พบกิจกรรมหรือไม่มีสิทธิ์แก้ไข" };
  await prisma.$transaction(async (tx) => {
    await tx.villageEvent.update({ where: { id }, data: normalized.value });
    await auditSuperAdmin(tx, context, { action: AuditAction.UPDATE, actionName: existing.isPublic !== normalized.value.isPublic ? "SUPERADMIN_EVENT_VISIBILITY_CHANGED" : "SUPERADMIN_EVENT_UPDATED", resource: "VillageEvent", resourceId: id, oldValue: { title: existing.title, startsAt: existing.startsAt.toISOString(), isPublic: existing.isPublic }, newValue: { title: normalized.value.title, startsAt: normalized.value.startsAt.toISOString(), isPublic: normalized.value.isPublic } });
  });
  revalidateVillagePublicContent(context, "calendar", id);
  return { success: true };
}

export async function deleteEvent(context: VillageActorContext, id: string): Promise<ActionResult> {
  const existing = await prisma.villageEvent.findFirst({ where: { id, villageId: context.villageId }, select: { id: true, title: true } });
  if (!existing) return { success: false, error: "ไม่พบกิจกรรมหรือไม่มีสิทธิ์ลบ" };
  await prisma.$transaction(async (tx) => {
    await tx.villageEvent.delete({ where: { id } });
    await auditSuperAdmin(tx, context, { action: AuditAction.DELETE, actionName: "SUPERADMIN_EVENT_DELETED", resource: "VillageEvent", resourceId: id, oldValue: { title: existing.title } });
  });
  revalidateVillagePublicContent(context, "calendar");
  return { success: true };
}

export async function createTransparency(context: VillageActorContext, input: TransparencyInput): Promise<ActionResult<{ id: string }>> {
  const normalized = normalizeTransparencyInput(input);
  if (!normalized.ok) return { success: false, error: normalized.error };
  const created = await prisma.$transaction(async (tx) => {
    const record = await tx.transparencyRecord.create({
      data: { villageId: context.villageId, ...normalized.value, publishedAt: normalized.value.stage === "PUBLISHED" ? new Date() : null },
      select: { id: true },
    });
    await auditSuperAdmin(tx, context, { action: AuditAction.CREATE, actionName: "SUPERADMIN_TRANSPARENCY_CREATED", resource: "TransparencyRecord", resourceId: record.id, newValue: { title: normalized.value.title, category: normalized.value.category, stage: normalized.value.stage, visibility: normalized.value.visibility } });
    return record;
  });
  revalidateVillagePublicContent(context, "transparency", created.id);
  return { success: true, id: created.id };
}

export async function updateTransparency(context: VillageActorContext, id: string, input: TransparencyInput): Promise<ActionResult> {
  const normalized = normalizeTransparencyInput(input);
  if (!normalized.ok) return { success: false, error: normalized.error };
  const existing = await prisma.transparencyRecord.findFirst({ where: { id, villageId: context.villageId }, select: { id: true, title: true, category: true, stage: true, visibility: true, publishedAt: true } });
  if (!existing) return { success: false, error: "ไม่พบรายการหรือไม่มีสิทธิ์แก้ไข" };
  const isFirstPublish = normalized.value.stage === "PUBLISHED" && (existing.stage !== "PUBLISHED" || !existing.publishedAt);
  await prisma.$transaction(async (tx) => {
    await tx.transparencyRecord.update({
      where: { id },
      data: { ...normalized.value, publishedAt: isFirstPublish ? new Date() : existing.publishedAt },
    });
    await auditSuperAdmin(tx, context, {
      action: AuditAction.UPDATE,
      actionName: existing.stage !== normalized.value.stage ? `SUPERADMIN_TRANSPARENCY_${normalized.value.stage}` : "SUPERADMIN_TRANSPARENCY_UPDATED",
      resource: "TransparencyRecord",
      resourceId: id,
      oldValue: { title: existing.title, category: existing.category, stage: existing.stage, visibility: existing.visibility },
      newValue: { title: normalized.value.title, category: normalized.value.category, stage: normalized.value.stage, visibility: normalized.value.visibility },
    });
  });
  revalidateVillagePublicContent(context, "transparency", id);
  return { success: true };
}

export async function deleteTransparency(context: VillageActorContext, id: string): Promise<ActionResult> {
  const existing = await prisma.transparencyRecord.findFirst({ where: { id, villageId: context.villageId }, select: { id: true, title: true } });
  if (!existing) return { success: false, error: "ไม่พบรายการหรือไม่มีสิทธิ์ลบ" };
  await prisma.$transaction(async (tx) => {
    await tx.transparencyRecord.delete({ where: { id } });
    await auditSuperAdmin(tx, context, { action: AuditAction.DELETE, actionName: "SUPERADMIN_TRANSPARENCY_DELETED", resource: "TransparencyRecord", resourceId: id, oldValue: { title: existing.title } });
  });
  revalidateVillagePublicContent(context, "transparency");
  return { success: true };
}

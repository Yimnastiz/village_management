"use server";

import { MembershipStatus, NewsVisibility, NotificationType, Prisma, TransparencyStage } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

const transparencyInputSchema = z.object({
  title: z.string().min(3, "กรุณาระบุหัวข้อ"),
  description: z.string().optional(),
  category: z.string().optional(),
  amount: z.number().optional(),
  fiscalYear: z.string().optional(),
  stage: z.string().min(1, "กรุณาเลือกสถานะ"),
  visibility: z.string().min(1, "กรุณาเลือกการมองเห็น"),
});

type TransparencyInput = {
  title: string;
  description?: string;
  category?: string;
  amount?: number;
  fiscalYear?: string;
  stage: string;
  visibility: string;
};

const VALID_STAGES: TransparencyStage[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const VALID_VISIBILITY: NewsVisibility[] = ["PUBLIC", "RESIDENT_ONLY"];

async function getResidentRecipientIds(villageId: string): Promise<string[]> {
  const residents = await prisma.villageMembership.findMany({
    where: { villageId, status: MembershipStatus.ACTIVE },
    select: { userId: true },
  });
  return residents.map((r) => r.userId);
}

async function notifyResidents(
  villageId: string,
  title: string,
  body: string,
  metadata?: Prisma.InputJsonObject
) {
  const recipientIds = await getResidentRecipientIds(villageId);
  if (recipientIds.length === 0) return;
  await prisma.notification.createMany({
    data: recipientIds.map((userId) => ({
      userId,
      villageId,
      type: NotificationType.SYSTEM,
      title,
      body,
      ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
    })),
  });
}

function revalidateTransparencyViews(recordId?: string) {
  revalidatePath("/resident", "layout");
  revalidatePath("/admin", "layout");
  revalidatePath("/resident/transparency");
  revalidatePath("/admin/transparency");
  revalidatePath("/resident/notifications");
  revalidatePath("/admin/notifications");
  if (recordId) {
    revalidatePath(`/resident/transparency/${recordId}`);
    revalidatePath(`/admin/transparency/${recordId}`);
  }
}

async function requireAdminVillage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    return { ok: false as const, error: "กรุณาเข้าสู่ระบบ", session: null, villageId: "" };
  }
  if (!isAdminUser(session)) {
    return { ok: false as const, error: "ไม่มีสิทธิ์ดำเนินการ", session: null, villageId: "" };
  }

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) {
    return { ok: false as const, error: "ไม่พบหมู่บ้านของคุณ", session: null, villageId: "" };
  }

  return { ok: true as const, error: null, session, villageId: membership.villageId };
}

function normalizeTransparencyInput(data: TransparencyInput) {
  const parsed = transparencyInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง",
    };
  }

  const stage = parsed.data.stage as TransparencyStage;
  const visibility = parsed.data.visibility as NewsVisibility;
  if (!VALID_STAGES.includes(stage)) {
    return { ok: false as const, error: "สถานะไม่ถูกต้อง" };
  }
  if (!VALID_VISIBILITY.includes(visibility)) {
    return { ok: false as const, error: "การมองเห็นไม่ถูกต้อง" };
  }

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

export async function createTransparencyAction(
  data: TransparencyInput
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeTransparencyInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const created = await prisma.transparencyRecord.create({
    data: {
      villageId: ctx.villageId,
      title: normalized.value.title,
      description: normalized.value.description,
      category: normalized.value.category,
      amount: normalized.value.amount,
      fiscalYear: normalized.value.fiscalYear,
      stage: normalized.value.stage,
      visibility: normalized.value.visibility,
      publishedAt: normalized.value.stage === "PUBLISHED" ? new Date() : null,
    },
    select: { id: true },
  });

  if (normalized.value.stage === "PUBLISHED") {
    await notifyResidents(
      ctx.villageId,
      `ความโปร่งใสใหม่: ${normalized.value.title}`,
      normalized.value.category
        ? `หมวดหมู่: ${normalized.value.category}`
        : "มีรายการความโปร่งใสใหม่ในหมู่บ้าน",
      { transparencyId: created.id }
    );
  }
  revalidateTransparencyViews(created.id);

  return { success: true, id: created.id };
}

export async function updateTransparencyAction(
  id: string,
  data: TransparencyInput
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeTransparencyInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const existing = await prisma.transparencyRecord.findFirst({
    where: { id, villageId: ctx.villageId },
    select: { id: true, stage: true, publishedAt: true },
  });
  if (!existing) {
    return { success: false, error: "ไม่พบรายการนี้หรือไม่มีสิทธิ์แก้ไข" };
  }

  const isFirstPublish =
    normalized.value.stage === "PUBLISHED" &&
    (existing.stage !== "PUBLISHED" || !existing.publishedAt);

  await prisma.transparencyRecord.update({
    where: { id },
    data: {
      title: normalized.value.title,
      description: normalized.value.description,
      category: normalized.value.category,
      amount: normalized.value.amount,
      fiscalYear: normalized.value.fiscalYear,
      stage: normalized.value.stage,
      visibility: normalized.value.visibility,
      publishedAt: isFirstPublish ? new Date() : existing.publishedAt,
    },
  });

  if (isFirstPublish) {
    await notifyResidents(
      ctx.villageId,
      `ความโปร่งใสใหม่: ${normalized.value.title}`,
      normalized.value.category
        ? `หมวดหมู่: ${normalized.value.category}`
        : "มีรายการความโปร่งใสใหม่ในหมู่บ้าน",
      { transparencyId: id }
    );
  }
  revalidateTransparencyViews(id);

  return { success: true };
}

export async function deleteTransparencyAction(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const existing = await prisma.transparencyRecord.findFirst({
    where: { id, villageId: ctx.villageId },
    select: { id: true },
  });
  if (!existing) {
    return { success: false, error: "ไม่พบรายการนี้หรือไม่มีสิทธิ์ลบ" };
  }

  await prisma.transparencyRecord.delete({ where: { id } });
  revalidateTransparencyViews();
  return { success: true };
}

export async function seedMockTransparencyAction(): Promise<
  { success: true; created: number } | { success: false; error: string }
> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const [publicExists, residentExists] = await Promise.all([
    prisma.transparencyRecord.findFirst({
      where: {
        villageId: ctx.villageId,
        title: "รายงานงบประมาณพัฒนาหมู่บ้าน (ตัวอย่าง PUBLIC)",
      },
      select: { id: true },
    }),
    prisma.transparencyRecord.findFirst({
      where: {
        villageId: ctx.villageId,
        title: "รายงานภายในคณะกรรมการ (ตัวอย่าง RESIDENT)",
      },
      select: { id: true },
    }),
  ]);

  const rows: Array<{
    villageId: string;
    title: string;
    description: string;
    category: string;
    amount: number;
    fiscalYear: string;
    stage: TransparencyStage;
    visibility: NewsVisibility;
    publishedAt: Date;
  }> = [];

  if (!publicExists) {
    rows.push({
      villageId: ctx.villageId,
      title: "รายงานงบประมาณพัฒนาหมู่บ้าน (ตัวอย่าง PUBLIC)",
      description: "สรุปงบประมาณและผลการใช้จ่ายโครงการปรับปรุงถนนสาธารณะ",
      category: "งบประมาณ/โครงการ",
      amount: 120000,
      fiscalYear: "2569",
      stage: "PUBLISHED",
      visibility: "PUBLIC",
      publishedAt: new Date(),
    });
  }

  if (!residentExists) {
    rows.push({
      villageId: ctx.villageId,
      title: "รายงานภายในคณะกรรมการ (ตัวอย่าง RESIDENT)",
      description: "รายละเอียดการประชุมและแผนจัดสรรงบประมาณภายในสำหรับลูกบ้าน",
      category: "รายงานประชุม",
      amount: 35000,
      fiscalYear: "2569",
      stage: "PUBLISHED",
      visibility: "RESIDENT_ONLY",
      publishedAt: new Date(),
    });
  }

  if (rows.length > 0) {
    await prisma.transparencyRecord.createMany({ data: rows });
  }

  return { success: true, created: rows.length };
}

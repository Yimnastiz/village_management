"use server";

import { DownloadStage, NewsVisibility, NotificationType, Prisma, VillageMembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const schema = z.object({
  title: z.string().min(3, "กรุณาระบุชื่อเอกสาร"),
  description: z.string().optional(),
  category: z.string().optional(),
  stage: z.string().min(1, "กรุณาเลือกสถานะ"),
  visibility: z.string().min(1, "กรุณาเลือกการมองเห็น"),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  fileSize: z.number().optional(),
  fileDataUrl: z.string().optional(),
});

type DownloadInput = z.infer<typeof schema>;

const VALID_STAGE: DownloadStage[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const VALID_VISIBILITY: NewsVisibility[] = ["PUBLIC", "RESIDENT_ONLY"];
const RESIDENT_MEMBERSHIP_ROLES: VillageMembershipRole[] = [VillageMembershipRole.RESIDENT];

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

function normalizeInput(data: DownloadInput, requireFile: boolean) {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง",
    };
  }

  const stage = parsed.data.stage as DownloadStage;
  const visibility = parsed.data.visibility as NewsVisibility;
  if (!VALID_STAGE.includes(stage)) {
    return { ok: false as const, error: "สถานะไม่ถูกต้อง" };
  }
  if (!VALID_VISIBILITY.includes(visibility)) {
    return { ok: false as const, error: "การมองเห็นไม่ถูกต้อง" };
  }

  const fileDataUrl = parsed.data.fileDataUrl?.trim() || "";
  const fileName = parsed.data.fileName?.trim() || "";
  const mimeType = parsed.data.mimeType?.trim() || null;
  const fileSize = parsed.data.fileSize ?? null;

  if (requireFile && (!fileDataUrl || !fileName)) {
    return { ok: false as const, error: "กรุณาอัปโหลดไฟล์เอกสาร" };
  }

  if (fileDataUrl && !fileDataUrl.startsWith("data:")) {
    return { ok: false as const, error: "รูปแบบไฟล์ไม่ถูกต้อง" };
  }

  if (fileSize != null && (Number.isNaN(fileSize) || fileSize < 0 || fileSize > MAX_FILE_SIZE)) {
    return { ok: false as const, error: "ไฟล์มีขนาดเกินกำหนด (สูงสุด 10MB)" };
  }

  return {
    ok: true as const,
    value: {
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      category: parsed.data.category?.trim() || null,
      stage,
      visibility,
      fileName: fileName || null,
      fileDataUrl: fileDataUrl || null,
      mimeType,
      fileSize,
    },
  };
}

async function getResidentRecipientIds(villageId: string) {
  const residents = await prisma.villageMembership.findMany({
    where: {
      villageId,
      status: "ACTIVE",
      role: { in: RESIDENT_MEMBERSHIP_ROLES },
    },
    select: { userId: true },
    distinct: ["userId"],
  });

  return residents.map((item) => item.userId);
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

function revalidateDownloadViews(fileId?: string) {
  revalidatePath("/resident", "layout");
  revalidatePath("/admin", "layout");
  revalidatePath("/resident/downloads");
  revalidatePath("/admin/downloads");
  revalidatePath("/resident/notifications");
  revalidatePath("/admin/notifications");

  if (fileId) {
    revalidatePath(`/resident/downloads/${fileId}`);
    revalidatePath(`/admin/downloads/${fileId}`);
  }
}

export async function createDownloadAction(
  data: DownloadInput
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeInput(data, true);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const created = await prisma.downloadFile.create({
    data: {
      villageId: ctx.villageId,
      title: normalized.value.title,
      description: normalized.value.description,
      category: normalized.value.category,
      stage: normalized.value.stage,
      visibility: normalized.value.visibility,
      fileKey: normalized.value.fileName,
      fileUrl: normalized.value.fileDataUrl,
      mimeType: normalized.value.mimeType,
      fileSize: normalized.value.fileSize,
      publishedAt: normalized.value.stage === "PUBLISHED" ? new Date() : null,
    },
    select: { id: true },
  });

  if (normalized.value.stage === "PUBLISHED") {
    await notifyResidents(
      ctx.villageId,
      "เอกสารดาวน์โหลด: มีเอกสารใหม่",
      `เอกสาร ${normalized.value.title} พร้อมให้ดาวน์โหลดแล้ว`,
      { fileId: created.id, actionUrl: `/resident/downloads/${created.id}` }
    );
  }

  revalidateDownloadViews(created.id);

  return { success: true, id: created.id };
}

export async function updateDownloadAction(
  fileId: string,
  data: DownloadInput
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const existing = await prisma.downloadFile.findFirst({
    where: { id: fileId, villageId: ctx.villageId },
    select: {
      id: true,
      stage: true,
      publishedAt: true,
      fileKey: true,
      fileUrl: true,
      mimeType: true,
      fileSize: true,
    },
  });
  if (!existing) {
    return { success: false, error: "ไม่พบเอกสารนี้หรือไม่มีสิทธิ์แก้ไข" };
  }

  const normalized = normalizeInput(data, false);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const shouldSetPublishedAt =
    normalized.value.stage === "PUBLISHED" &&
    (existing.stage !== "PUBLISHED" || !existing.publishedAt);

  await prisma.downloadFile.update({
    where: { id: fileId },
    data: {
      title: normalized.value.title,
      description: normalized.value.description,
      category: normalized.value.category,
      stage: normalized.value.stage,
      visibility: normalized.value.visibility,
      fileKey: normalized.value.fileName ?? existing.fileKey,
      fileUrl: normalized.value.fileDataUrl ?? existing.fileUrl,
      mimeType: normalized.value.mimeType ?? existing.mimeType,
      fileSize: normalized.value.fileSize ?? existing.fileSize,
      publishedAt: shouldSetPublishedAt ? new Date() : existing.publishedAt,
    },
  });

  if (normalized.value.stage === "PUBLISHED") {
    await notifyResidents(
      ctx.villageId,
      existing.stage === "PUBLISHED" ? "เอกสารดาวน์โหลด: มีการอัปเดต" : "เอกสารดาวน์โหลด: เผยแพร่แล้ว",
      existing.stage === "PUBLISHED"
        ? `เอกสาร ${normalized.value.title} มีการอัปเดตข้อมูล`
        : `เอกสาร ${normalized.value.title} พร้อมให้ดาวน์โหลดแล้ว`,
      { fileId, actionUrl: `/resident/downloads/${fileId}` }
    );
  }

  revalidateDownloadViews(fileId);

  return { success: true };
}

export async function deleteDownloadAction(
  fileId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const existing = await prisma.downloadFile.findFirst({
    where: { id: fileId, villageId: ctx.villageId },
    select: { id: true },
  });
  if (!existing) {
    return { success: false, error: "ไม่พบเอกสารนี้หรือไม่มีสิทธิ์ลบ" };
  }

  await prisma.downloadFile.delete({ where: { id: fileId } });
  revalidateDownloadViews(fileId);
  return { success: true };
}

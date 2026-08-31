"use server";

import { createNews, deleteNews, updateNews } from "@/features/village-public-content/server/service";
import { requireSuperAdminVillageContext, requireSupportReason } from "@/features/village-public-content/server/context";
import { prisma } from "@/lib/prisma";
import { verifyPlaceUploadToken } from "@/lib/place-upload.server";

type NewsImage = { url: string; fileKey?: string; uploadToken?: string; fileName?: string; sizeBytes?: number; sortOrder: number; isCover: boolean };
type NewsPayload = { title: string; summary?: string; content: string; images: NewsImage[]; visibility: string; stage: "DRAFT" | "PUBLISHED" | "ARCHIVED"; isPinned: boolean };
type Result = { success: true; newsId?: string } | { success: false; error: string };

const uploadUrl = (fileKey: string) => `/api/places/images?key=${encodeURIComponent(fileKey)}`;

function trustedImageUrls(images: NewsImage[], villageId: string, existingUrls: readonly string[] = []) {
  const existing = new Set(existingUrls);
  const urls: string[] = [];
  for (const image of [...images].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const url = image.url.trim();
    if (existing.has(url)) { urls.push(url); continue; }
    if (!image.fileKey || url !== uploadUrl(image.fileKey) || !verifyPlaceUploadToken(image.uploadToken, image.fileKey, villageId)) return null;
    urls.push(url);
  }
  return urls;
}

async function contextWithReason(villageId: string, supportReason: string) {
  const context = await requireSuperAdminVillageContext(villageId);
  return { ...context, supportReason: requireSupportReason(supportReason) };
}

export async function superAdminCreateNewsAction(villageId: string, payload: NewsPayload, supportReason: string): Promise<Result> {
  try {
    const context = await contextWithReason(villageId, supportReason);
    if (payload.stage === "ARCHIVED") return { success: false, error: "ไม่สามารถสร้างข่าวในสถานะจัดเก็บได้" };
    const imageUrls = trustedImageUrls(payload.images, context.villageId);
    if (!imageUrls) return { success: false, error: "ข้อมูลรูปภาพไม่ถูกต้อง กรุณาอัปโหลดใหม่อีกครั้ง" };
    const coverUrl = payload.images.find((image) => image.isCover)?.url ?? imageUrls[0] ?? null;
    const result = await createNews(context, { ...payload, imageUrls, coverUrl });
    return result.success ? { success: true, newsId: result.newsId } : result;
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "ไม่สามารถสร้างข่าวได้" }; }
}

export async function superAdminUpdateNewsAction(villageId: string, newsId: string, payload: NewsPayload, supportReason: string): Promise<Result> {
  try {
    const context = await contextWithReason(villageId, supportReason);
    const existing = await prisma.news.findFirst({ where: { id: newsId, villageId: context.villageId }, select: { imageUrls: true } });
    if (!existing) return { success: false, error: "ไม่พบข่าวในหมู่บ้านเป้าหมาย" };
    const existingUrls = Array.isArray(existing.imageUrls) ? existing.imageUrls.map(String) : [];
    const imageUrls = trustedImageUrls(payload.images, context.villageId, existingUrls);
    if (!imageUrls) return { success: false, error: "ข้อมูลรูปภาพไม่ถูกต้อง กรุณาอัปโหลดใหม่อีกครั้ง" };
    const coverUrl = payload.images.find((image) => image.isCover)?.url ?? imageUrls[0] ?? null;
    return updateNews(context, newsId, { ...payload, imageUrls, coverUrl });
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "ไม่สามารถบันทึกข่าวได้" }; }
}

export async function superAdminChangeNewsStageAction(villageId: string, newsId: string, stage: "DRAFT" | "PUBLISHED" | "ARCHIVED", supportReason: string): Promise<Result> {
  try {
    const context = await contextWithReason(villageId, supportReason);
    const existing = await prisma.news.findFirst({ where: { id: newsId, villageId: context.villageId }, select: { title: true, summary: true, content: true, imageUrls: true, coverUrl: true, visibility: true, isPinned: true } });
    if (!existing) return { success: false, error: "ไม่พบข่าวในหมู่บ้านเป้าหมาย" };
    return updateNews(context, newsId, { ...existing, summary: existing.summary ?? "", imageUrls: Array.isArray(existing.imageUrls) ? existing.imageUrls.map(String) : [], coverUrl: existing.coverUrl, stage });
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "ไม่สามารถเปลี่ยนสถานะข่าวได้" }; }
}

export async function superAdminDeleteNewsAction(villageId: string, newsId: string, supportReason: string): Promise<Result> {
  try {
    const context = await contextWithReason(villageId, supportReason);
    return deleteNews(context, newsId);
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "ไม่สามารถลบข่าวได้" }; }
}

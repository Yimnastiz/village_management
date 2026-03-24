"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";

type ToggleResult = { success: true; saved: boolean } | { success: false; error: string };

export async function toggleSaveIssueAction(issueId: string): Promise<ToggleResult> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบ" };
  const membership = getResidentMembership(session);
  if (!membership) return { success: false, error: "ไม่พบหมู่บ้านของคุณ" };

  const issue = await prisma.issue.findFirst({
    where: { id: issueId, villageId: membership.villageId },
    select: { id: true },
  });
  if (!issue) return { success: false, error: "ไม่พบปัญหานี้" };

  const existing = await prisma.savedItem.findFirst({
    where: { userId: session.id, issueId },
    select: { id: true },
  });
  if (existing) {
    await prisma.savedItem.delete({ where: { id: existing.id } });
    revalidatePath("/resident/saved");
    return { success: true, saved: false };
  }
  await prisma.savedItem.create({ data: { userId: session.id, issueId } });
  revalidatePath("/resident/saved");
  return { success: true, saved: true };
}

export async function toggleSaveAlbumAction(galleryAlbumId: string): Promise<ToggleResult> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบ" };
  const membership = getResidentMembership(session);
  if (!membership) return { success: false, error: "ไม่พบหมู่บ้านของคุณ" };

  const album = await prisma.galleryAlbum.findFirst({
    where: { id: galleryAlbumId, villageId: membership.villageId },
    select: { id: true },
  });
  if (!album) return { success: false, error: "ไม่พบอัลบั้มนี้" };

  const existing = await prisma.savedItem.findFirst({
    where: { userId: session.id, galleryAlbumId },
    select: { id: true },
  });
  if (existing) {
    await prisma.savedItem.delete({ where: { id: existing.id } });
    revalidatePath("/resident/saved");
    return { success: true, saved: false };
  }
  await prisma.savedItem.create({ data: { userId: session.id, galleryAlbumId } });
  revalidatePath("/resident/saved");
  return { success: true, saved: true };
}

export async function toggleSaveDownloadAction(downloadId: string): Promise<ToggleResult> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบ" };
  const membership = getResidentMembership(session);
  if (!membership) return { success: false, error: "ไม่พบหมู่บ้านของคุณ" };

  const file = await prisma.downloadFile.findFirst({
    where: { id: downloadId, villageId: membership.villageId, stage: "PUBLISHED" },
    select: { id: true },
  });
  if (!file) return { success: false, error: "ไม่พบเอกสารนี้" };

  const existing = await prisma.savedItem.findFirst({
    where: { userId: session.id, downloadId },
    select: { id: true },
  });
  if (existing) {
    await prisma.savedItem.delete({ where: { id: existing.id } });
    revalidatePath("/resident/saved");
    return { success: true, saved: false };
  }
  await prisma.savedItem.create({ data: { userId: session.id, downloadId } });
  revalidatePath("/resident/saved");
  return { success: true, saved: true };
}

export async function toggleSaveTransparencyAction(transparencyId: string): Promise<ToggleResult> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบ" };
  const membership = getResidentMembership(session);
  if (!membership) return { success: false, error: "ไม่พบหมู่บ้านของคุณ" };

  const record = await prisma.transparencyRecord.findFirst({
    where: { id: transparencyId, villageId: membership.villageId, stage: "PUBLISHED" },
    select: { id: true },
  });
  if (!record) return { success: false, error: "ไม่พบรายการนี้" };

  const existing = await prisma.savedItem.findFirst({
    where: { userId: session.id, transparencyId },
    select: { id: true },
  });
  if (existing) {
    await prisma.savedItem.delete({ where: { id: existing.id } });
    revalidatePath("/resident/saved");
    return { success: true, saved: false };
  }
  await prisma.savedItem.create({ data: { userId: session.id, transparencyId } });
  revalidatePath("/resident/saved");
  return { success: true, saved: true };
}

export async function toggleSaveContactAction(contactId: string): Promise<ToggleResult> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบ" };
  const membership = getResidentMembership(session);
  if (!membership) return { success: false, error: "ไม่พบหมู่บ้านของคุณ" };

  const contact = await prisma.contactDirectory.findFirst({
    where: { id: contactId, villageId: membership.villageId },
    select: { id: true },
  });
  if (!contact) return { success: false, error: "ไม่พบรายชื่อนี้" };

  const existing = await prisma.savedItem.findFirst({
    where: { userId: session.id, contactId },
    select: { id: true },
  });
  if (existing) {
    await prisma.savedItem.delete({ where: { id: existing.id } });
    revalidatePath("/resident/saved");
    return { success: true, saved: false };
  }
  await prisma.savedItem.create({ data: { userId: session.id, contactId } });
  revalidatePath("/resident/saved");
  return { success: true, saved: true };
}

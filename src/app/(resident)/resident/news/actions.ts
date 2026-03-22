"use server";

import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies } from "@/lib/access-control";

export async function toggleSaveNewsAction(
  newsId: string
): Promise<{ success: true; saved: boolean } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    return { success: false, error: "กรุณาเข้าสู่ระบบ" };
  }

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) {
    return { success: false, error: "ไม่พบหมู่บ้านของคุณ" };
  }

  const news = await prisma.news.findFirst({
    where: {
      id: newsId,
      villageId: membership.villageId,
      stage: "PUBLISHED",
      visibility: { in: ["PUBLIC", "RESIDENT_ONLY"] },
    },
    select: { id: true },
  });
  if (!news) {
    return { success: false, error: "ไม่พบข่าวนี้" };
  }

  const existing = await prisma.savedItem.findFirst({
    where: {
      userId: session.id,
      newsId,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.savedItem.delete({ where: { id: existing.id } });
    return { success: true, saved: false };
  }

  await prisma.savedItem.create({
    data: {
      userId: session.id,
      newsId,
    },
  });
  return { success: true, saved: true };
}

"use server";

import { NewsStage, NewsVisibility } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, getResidentMembership } from "@/lib/access-control";

const requestSchema = z.object({
  title: z.string().min(3, "กรุณาระบุหัวข้อข่าว"),
  summary: z.string().optional(),
  content: z.string().min(10, "กรุณาระบุเนื้อหาอย่างน้อย 10 ตัวอักษร"),
  imageUrls: z.array(z.string().url("URL รูปภาพไม่ถูกต้อง")).optional(),
  visibility: z.string().min(1, "กรุณาเลือกการแสดงผล"),
  stage: z.string().min(1, "กรุณาเลือกสถานะ"),
  isPinned: z.boolean().optional(),
});

type RequestInput = z.infer<typeof requestSchema>;

const VALID_VISIBILITY: NewsVisibility[] = ["PUBLIC", "RESIDENT_ONLY"];
const VALID_STAGE: NewsStage[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

async function requireResidentVillage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    return { ok: false as const, error: "กรุณาเข้าสู่ระบบ", userId: "", villageId: "" };
  }

  const membership = getResidentMembership(session);
  if (!membership) {
    return { ok: false as const, error: "ไม่พบหมู่บ้านของคุณ", userId: "", villageId: "" };
  }

  return { ok: true as const, error: null, userId: session.id, villageId: membership.villageId };
}

function normalizeInput(data: RequestInput) {
  const parsed = requestSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false as const,
      error:
        Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง",
    };
  }

  const visibility = parsed.data.visibility as NewsVisibility;
  const stage = parsed.data.stage as NewsStage;

  if (!VALID_VISIBILITY.includes(visibility)) {
    return { ok: false as const, error: "ประเภทการแสดงผลไม่ถูกต้อง" };
  }
  if (!VALID_STAGE.includes(stage)) {
    return { ok: false as const, error: "สถานะข่าวไม่ถูกต้อง" };
  }

  return {
    ok: true as const,
    value: {
      title: parsed.data.title.trim(),
      summary: parsed.data.summary?.trim() || "",
      content: parsed.data.content.trim(),
      imageUrls: (parsed.data.imageUrls ?? []).filter((url) => url.trim().length > 0),
      visibility,
      stage,
      isPinned: Boolean(parsed.data.isPinned),
    },
  };
}

export async function createNewsCreateRequestAction(
  data: RequestInput
): Promise<{ success: true; requestId: string } | { success: false; error: string }> {
  const ctx = await requireResidentVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const created = await prisma.newsSubmission.create({
    data: {
      villageId: ctx.villageId,
      requesterId: ctx.userId,
      type: "CREATE",
      payload: normalized.value,
    },
    select: { id: true },
  });

  return { success: true, requestId: created.id };
}

export async function createNewsUpdateRequestAction(
  targetNewsId: string,
  data: RequestInput
): Promise<{ success: true; requestId: string } | { success: false; error: string }> {
  const ctx = await requireResidentVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const targetNews = await prisma.news.findFirst({
    where: {
      id: targetNewsId,
      villageId: ctx.villageId,
    },
    select: { id: true },
  });
  if (!targetNews) {
    return { success: false, error: "ไม่พบข่าวปลายทาง" };
  }

  const normalized = normalizeInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const created = await prisma.newsSubmission.create({
    data: {
      villageId: ctx.villageId,
      requesterId: ctx.userId,
      type: "UPDATE",
      targetNewsId,
      payload: normalized.value,
    },
    select: { id: true },
  });

  return { success: true, requestId: created.id };
}

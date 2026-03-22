"use server";

import { IssueCategory, IssuePriority, IssueStage } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

const issueInputSchema = z.object({
  title: z.string().min(5, "หัวข้อต้องมีอย่างน้อย 5 ตัวอักษร"),
  description: z.string().min(10, "รายละเอียดต้องมีอย่างน้อย 10 ตัวอักษร"),
  category: z.string().min(1, "กรุณาเลือกหมวดหมู่"),
  priority: z.string().min(1, "กรุณาเลือกระดับความสำคัญ"),
  location: z.string().optional(),
});

type IssueInput = {
  title: string;
  description: string;
  category: string;
  priority: string;
  location?: string;
};

async function requireAdminCtx() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { error: "กรุณาเข้าสู่ระบบ" as const, session: null, villageId: "" };
  if (!isAdminUser(session))
    return { error: "ไม่มีสิทธิ์ดำเนินการ" as const, session: null, villageId: "" };
  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
  });
  if (!membership)
    return { error: "ไม่พบหมู่บ้านของคุณ" as const, session: null, villageId: "" };
  return { error: null, session, villageId: membership.villageId };
}

export async function adminCreateIssueAction(
  data: IssueInput
): Promise<{ success: true; issueId: string } | { success: false; error: string }> {
  const ctx = await requireAdminCtx();
  if (ctx.error) return { success: false, error: ctx.error };

  const parsed = issueInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง",
    };
  }

  const issue = await prisma.issue.create({
    data: {
      villageId: ctx.villageId,
      reporterId: ctx.session!.id,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category as IssueCategory,
      priority: parsed.data.priority as IssuePriority,
      location: parsed.data.location?.trim() || null,
    },
  });

  await prisma.issueTimeline.create({
    data: {
      issueId: issue.id,
      actorId: ctx.session!.id,
      action: "แจ้งปัญหา",
      description: "แอดมินสร้างคำร้องใหม่",
    },
  });

  return { success: true, issueId: issue.id };
}

export async function adminEditIssueAction(
  issueId: string,
  data: IssueInput
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminCtx();
  if (ctx.error) return { success: false, error: ctx.error };

  const parsed = issueInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง",
    };
  }

  const issue = await prisma.issue.findFirst({
    where: { id: issueId, villageId: ctx.villageId },
  });
  if (!issue) return { success: false, error: "ไม่พบคำร้องหรือไม่ใช่คำร้องในหมู่บ้านของคุณ" };

  await prisma.issue.update({
    where: { id: issueId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category as IssueCategory,
      priority: parsed.data.priority as IssuePriority,
      location: parsed.data.location?.trim() || null,
    },
  });

  await prisma.issueTimeline.create({
    data: {
      issueId,
      actorId: ctx.session!.id,
      action: "แก้ไขคำร้อง",
      description: "แอดมินแก้ไขรายละเอียดคำร้อง",
    },
  });

  return { success: true };
}

const VALID_STAGES: IssueStage[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING",
  "RESOLVED",
  "CLOSED",
  "REJECTED",
];

const STAGE_LABELS: Record<string, string> = {
  OPEN: "เปิด",
  IN_PROGRESS: "กำลังดำเนินการ",
  WAITING: "รอดำเนินการ",
  RESOLVED: "แก้ไขแล้ว",
  CLOSED: "ปิด",
  REJECTED: "ปฏิเสธ",
};

export async function adminUpdateStageAction(
  issueId: string,
  stage: string,
  note?: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminCtx();
  if (ctx.error) return { success: false, error: ctx.error };

  if (!(VALID_STAGES as string[]).includes(stage)) {
    return { success: false, error: "สถานะไม่ถูกต้อง" };
  }

  const issue = await prisma.issue.findFirst({
    where: { id: issueId, villageId: ctx.villageId },
  });
  if (!issue) return { success: false, error: "ไม่พบคำร้อง" };

  await prisma.issue.update({
    where: { id: issueId },
    data: {
      stage: stage as IssueStage,
      ...(stage === "RESOLVED" && { resolvedAt: new Date() }),
      ...(stage === "CLOSED" && { closedAt: new Date() }),
    },
  });

  await prisma.issueTimeline.create({
    data: {
      issueId,
      actorId: ctx.session!.id,
      action: `เปลี่ยนสถานะเป็น "${STAGE_LABELS[stage]}"`,
      description: note?.trim() || null,
    },
  });

  return { success: true };
}

export async function adminDeleteIssueAction(
  issueId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminCtx();
  if (ctx.error) return { success: false, error: ctx.error };

  const issue = await prisma.issue.findFirst({
    where: { id: issueId, villageId: ctx.villageId },
  });
  if (!issue) return { success: false, error: "ไม่พบคำร้อง" };

  await prisma.issue.delete({ where: { id: issueId } });
  return { success: true };
}

export async function adminAddMessageAction(
  issueId: string,
  content: string,
  isInternal: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminCtx();
  if (ctx.error) return { success: false, error: ctx.error };

  const trimmed = content.trim();
  if (trimmed.length < 2) return { success: false, error: "กรุณาระบุข้อความ (อย่างน้อย 2 ตัวอักษร)" };

  const issue = await prisma.issue.findFirst({
    where: { id: issueId, villageId: ctx.villageId },
  });
  if (!issue) return { success: false, error: "ไม่พบคำร้อง" };

  await prisma.issueMessage.create({
    data: { issueId, senderId: ctx.session!.id, content: trimmed, isInternal },
  });

  return { success: true };
}

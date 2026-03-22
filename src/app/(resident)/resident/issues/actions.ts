"use server";

import { IssueCategory, IssuePriority } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies } from "@/lib/access-control";

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

export async function createIssueAction(
  data: IssueInput
): Promise<{ success: true; issueId: string } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบอีกครั้ง" };

  const parsed = issueInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง",
    };
  }

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
  });
  if (!membership) return { success: false, error: "ไม่พบหมู่บ้านของคุณ" };

  const issue = await prisma.issue.create({
    data: {
      villageId: membership.villageId,
      reporterId: session.id,
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
      actorId: session.id,
      action: "แจ้งปัญหา",
      description: "สร้างคำร้องใหม่",
    },
  });

  return { success: true, issueId: issue.id };
}

export async function editIssueAction(
  issueId: string,
  data: IssueInput
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบอีกครั้ง" };

  const parsed = issueInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง",
    };
  }

  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) return { success: false, error: "ไม่พบคำร้อง" };
  if (issue.reporterId !== session.id) return { success: false, error: "ไม่มีสิทธิ์แก้ไขคำร้องนี้" };
  if (issue.stage !== "OPEN") {
    return { success: false, error: "แก้ไขได้เฉพาะคำร้องที่ยังไม่ถูกรับไปดำเนินการ" };
  }

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
      actorId: session.id,
      action: "แก้ไขคำร้อง",
      description: "ผู้แจ้งแก้ไขรายละเอียดคำร้อง",
    },
  });

  return { success: true };
}

export async function deleteIssueAction(
  issueId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบอีกครั้ง" };

  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) return { success: false, error: "ไม่พบคำร้อง" };
  if (issue.reporterId !== session.id) return { success: false, error: "ไม่มีสิทธิ์ลบคำร้องนี้" };
  if (issue.stage !== "OPEN") {
    return { success: false, error: "ลบได้เฉพาะคำร้องที่สถานะ 'เปิด' เท่านั้น" };
  }

  await prisma.issue.delete({ where: { id: issueId } });
  return { success: true };
}

export async function addIssueMessageAction(
  issueId: string,
  content: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบอีกครั้ง" };

  const trimmed = content.trim();
  if (trimmed.length < 2) return { success: false, error: "กรุณาระบุข้อความ (อย่างน้อย 2 ตัวอักษร)" };

  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) return { success: false, error: "ไม่พบคำร้อง" };

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, villageId: issue.villageId, status: "ACTIVE" },
  });
  if (!membership && issue.reporterId !== session.id) {
    return { success: false, error: "ไม่มีสิทธิ์แสดงความคิดเห็น" };
  }

  await prisma.issueMessage.create({
    data: {
      issueId,
      senderId: session.id,
      content: trimmed,
      isInternal: false,
    },
  });

  return { success: true };
}

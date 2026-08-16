"use server";

import {
  IssueCategory,
  IssuePriority,
  IssueStage,
  NotificationType,
  Prisma,
  VillageMembershipRole,
} from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { revalidateAdminSidebar } from "@/lib/revalidate-admin-sidebar";
import { getAdminMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { getIssueUserStatus, ISSUE_ALLOWED_TRANSITIONS, ISSUE_STATUS_META, ISSUE_USER_STATUS_TO_STAGE, type IssueUserStatus } from "@/lib/issues/status";

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

const ADMIN_MEMBERSHIP_ROLES: VillageMembershipRole[] = [
  VillageMembershipRole.HEADMAN,
  VillageMembershipRole.ASSISTANT_HEADMAN,
  VillageMembershipRole.COMMITTEE,
];

async function notifyIssueStakeholders(params: {
  villageId: string;
  issueId: string;
  actorUserId: string;
  title: string;
  body: string;
  reporterId?: string;
  includeReporter?: boolean;
  includeAdmins?: boolean;
  metadata?: Prisma.InputJsonObject;
}) {
  const recipients = new Set<string>();

  if (params.includeAdmins) {
    const admins = await prisma.villageMembership.findMany({
      where: {
        villageId: params.villageId,
        status: "ACTIVE",
        role: { in: ADMIN_MEMBERSHIP_ROLES },
      },
      select: { userId: true },
    });

    for (const admin of admins) {
      if (admin.userId !== params.actorUserId) recipients.add(admin.userId);
    }
  }

  if (params.includeReporter && params.reporterId && params.reporterId !== params.actorUserId) {
    recipients.add(params.reporterId);
  }

  if (recipients.size === 0) return;

  await prisma.notification.createMany({
    data: Array.from(recipients).map((userId) => ({
      villageId: params.villageId,
      userId,
      type: NotificationType.ISSUE_UPDATE,
      title: params.title,
      body: params.body,
      metadata: {
        issueId: params.issueId,
        ...(params.metadata ?? {}),
      } as Prisma.InputJsonValue,
    })),
  });
}

async function requireAdminCtx() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { error: "กรุณาเข้าสู่ระบบ" as const, session: null, villageId: "" };
  const membership = getAdminMembership(session);
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
      stage: "WAITING",
    },
  });

  await prisma.issueTimeline.create({
    data: {
      issueId: issue.id,
      actorId: ctx.session!.id,
      action: "แจ้งปัญหา",
      description: "แอดมินสร้างคำร้องใหม่",
      metadata: { eventType: "STATUS_CHANGE", stage: "PENDING" },
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

export async function adminUpdateStageAction(
  issueId: string,
  stage: string,
  note?: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminCtx();
  if (ctx.error) return { success: false, error: ctx.error };

  if (!Object.hasOwn(ISSUE_USER_STATUS_TO_STAGE, stage)) {
    return { success: false, error: "สถานะไม่ถูกต้อง" };
  }

  const issue = await prisma.issue.findFirst({
    where: { id: issueId, villageId: ctx.villageId },
  });
  if (!issue) return { success: false, error: "ไม่พบคำร้อง" };

  const currentStatus = getIssueUserStatus(issue.stage);
  const nextStatus = stage as IssueUserStatus;
  if (!ISSUE_ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus)) {
    return { success: false, error: "ไม่สามารถเปลี่ยนสถานะตามลำดับงานนี้ได้" };
  }
  const trimmedNote = note?.trim() || "";
  if (nextStatus === "REJECTED" && (trimmedNote.length < 5 || trimmedNote.length > 500)) {
    return { success: false, error: "เหตุผลที่ปฏิเสธต้องมี 5–500 ตัวอักษร" };
  }
  const persistedStage = ISSUE_USER_STATUS_TO_STAGE[nextStatus] as IssueStage;

  await prisma.issue.update({
    where: { id: issueId },
    data: {
      stage: persistedStage,
      ...(nextStatus === "RESOLVED" && { resolvedAt: new Date() }),
    },
  });

  await prisma.issueTimeline.create({
    data: {
      issueId,
      actorId: ctx.session!.id,
      action: "เปลี่ยนสถานะ",
      description: trimmedNote || null,
      metadata: { eventType: "STATUS_CHANGE", stage: nextStatus },
    },
  });

  await notifyIssueStakeholders({
    villageId: issue.villageId,
    issueId,
    actorUserId: ctx.session!.id,
    reporterId: issue.reporterId,
    includeReporter: true,
    includeAdmins: true,
    title: "สถานะคำร้องถูกอัปเดต",
    body: `${issue.title} • ${ISSUE_STATUS_META[nextStatus].label}`,
    metadata: {
      stage: nextStatus,
      note: trimmedNote || undefined,
    },
  });

  revalidatePath(`/resident/issues/${issueId}`);
  revalidatePath("/resident/issues");
  revalidatePath("/admin/issues");
  revalidatePath(`/admin/issues/${issueId}`);
  revalidateAdminSidebar();
  revalidatePath("/resident/notifications");
  revalidatePath("/admin/notifications");

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

  await notifyIssueStakeholders({
    villageId: issue.villageId,
    issueId,
    actorUserId: ctx.session!.id,
    reporterId: issue.reporterId,
    includeReporter: !isInternal,
    includeAdmins: true,
    title: isInternal ? "มีบันทึกภายในใหม่ในคำร้อง" : "มีข้อความใหม่จากผู้ดูแลในคำร้อง",
    body: trimmed,
    metadata: {
      isInternal,
    },
  });

  revalidatePath(`/resident/issues/${issueId}`);
  revalidatePath(`/admin/issues/${issueId}`);
  revalidatePath("/resident/notifications");
  revalidatePath("/admin/notifications");

  return { success: true };
}

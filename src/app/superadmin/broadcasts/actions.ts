"use server";

import { AuditAction, NotificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminActionSession, writeSuperAdminAuditLog } from "@/lib/superadmin";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

type BroadcastMetadata = {
  source: "SUPERADMIN_BROADCAST";
  broadcastGroupId: string;
  expiresAt: string | null;
};

function computeExpiresAt(formData: FormData): Date | null {
  const expiryMode = readText(formData, "expiryMode");
  const now = new Date();

  if (expiryMode === "ONE_HOUR") {
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  if (expiryMode === "ONE_DAY") {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  if (expiryMode === "CUSTOM") {
    const customHours = Number(readText(formData, "customHours"));
    if (!Number.isFinite(customHours) || customHours <= 0) {
      throw new Error("กรุณากำหนดจำนวนชั่วโมงที่ถูกต้อง");
    }
    return new Date(now.getTime() + customHours * 60 * 60 * 1000);
  }

  return null;
}

function parseMetadata(input: unknown): BroadcastMetadata | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const metadata = input as Record<string, unknown>;
  if (metadata.source !== "SUPERADMIN_BROADCAST") {
    return null;
  }

  const broadcastGroupId =
    typeof metadata.broadcastGroupId === "string" && metadata.broadcastGroupId.trim().length > 0
      ? metadata.broadcastGroupId.trim()
      : null;

  if (!broadcastGroupId) {
    return null;
  }

  return {
    source: "SUPERADMIN_BROADCAST",
    broadcastGroupId,
    expiresAt:
      typeof metadata.expiresAt === "string" && metadata.expiresAt.trim().length > 0
        ? metadata.expiresAt
        : null,
  };
}

function buildMetadata(groupId: string, expiresAt: Date | null): BroadcastMetadata {
  return {
    source: "SUPERADMIN_BROADCAST",
    broadcastGroupId: groupId,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
  };
}

async function getTargetMemberships() {
  return prisma.villageMembership.findMany({
    where: { status: "ACTIVE" },
    select: {
      userId: true,
      villageId: true,
      role: true,
    },
  });
}

export async function broadcastAnnouncementAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();

  const title = readText(formData, "title");
  const body = readText(formData, "body");
  const expiresAt = computeExpiresAt(formData);
  const groupId = randomUUID();

  if (!title || !body) {
    throw new Error("กรุณากรอกหัวข้อและเนื้อหาประกาศ");
  }

  const memberships = await getTargetMemberships();
  if (memberships.length === 0) {
    throw new Error("ไม่พบผู้ใช้ที่มีสมาชิกหมู่บ้านแบบ ACTIVE");
  }

  const metadata = buildMetadata(groupId, expiresAt);
  const notificationRows = memberships.map((membership) => ({
    userId: membership.userId,
    villageId: membership.villageId,
    type: NotificationType.SYSTEM,
    title,
    body,
    metadata,
  }));

  await prisma.notification.createMany({ data: notificationRows });

  await writeSuperAdminAuditLog({
    userId: session.id,
    action: AuditAction.CREATE,
    resource: "SystemWideBroadcast",
    resourceId: groupId,
    metadata: {
      title,
      notifiedUsers: notificationRows.length,
      expiresAt: expiresAt?.toISOString() ?? null,
    },
  });

  revalidatePath("/superadmin/broadcasts");
  revalidatePath("/superadmin/dashboard");
  revalidatePath("/resident/news");
  revalidatePath("/resident/notifications");
  revalidatePath("/admin/news");
  revalidatePath("/admin/notifications");
}

export async function updateBroadcastAnnouncementAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();

  const groupId = readText(formData, "broadcastGroupId");
  const title = readText(formData, "title");
  const body = readText(formData, "body");
  const expiresAt = computeExpiresAt(formData);

  if (!groupId || !title || !body) {
    throw new Error("ข้อมูลประกาศไม่ครบถ้วน");
  }

  const existing = await prisma.notification.findFirst({
    where: {
      type: NotificationType.SYSTEM,
      metadata: {
        path: ["broadcastGroupId"],
        equals: groupId,
      },
      status: { in: ["UNREAD", "READ"] },
    },
    select: { id: true, metadata: true },
  });

  const parsed = parseMetadata(existing?.metadata);
  if (!existing || !parsed) {
    throw new Error("ไม่พบประกาศที่ต้องการแก้ไข");
  }

  await prisma.notification.updateMany({
    where: {
      type: NotificationType.SYSTEM,
      metadata: {
        path: ["broadcastGroupId"],
        equals: groupId,
      },
      status: { in: ["UNREAD", "READ"] },
    },
    data: {
      title,
      body,
      metadata: buildMetadata(groupId, expiresAt) as any,
    },
  });

  await writeSuperAdminAuditLog({
    userId: session.id,
    action: AuditAction.UPDATE,
    resource: "SystemWideBroadcast",
    resourceId: groupId,
    metadata: {
      title,
      expiresAt: expiresAt?.toISOString() ?? null,
    },
  });

  revalidatePath("/superadmin/broadcasts");
  revalidatePath("/resident/news");
  revalidatePath("/resident/notifications");
  revalidatePath("/admin/news");
  revalidatePath("/admin/notifications");
}

export async function deleteBroadcastAnnouncementAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();
  const groupId = readText(formData, "broadcastGroupId");

  if (!groupId) {
    throw new Error("ไม่พบประกาศที่ต้องการลบ");
  }

  const result = await prisma.notification.updateMany({
    where: {
      type: NotificationType.SYSTEM,
      metadata: {
        path: ["broadcastGroupId"],
        equals: groupId,
      },
      status: { in: ["UNREAD", "READ"] },
    },
    data: {
      status: "ARCHIVED",
    },
  });

  if (result.count === 0) {
    throw new Error("ไม่พบประกาศที่ต้องการลบ");
  }

  await writeSuperAdminAuditLog({
    userId: session.id,
    action: AuditAction.DELETE,
    resource: "SystemWideBroadcast",
    resourceId: groupId,
    metadata: { archivedNotifications: result.count },
  });

  revalidatePath("/superadmin/broadcasts");
  revalidatePath("/resident/news");
  revalidatePath("/resident/notifications");
  revalidatePath("/admin/news");
  revalidatePath("/admin/notifications");
}

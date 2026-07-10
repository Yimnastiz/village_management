"use server";

import { NotificationStatus, NotificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

type RequestPayload = {
  name: string;
  role: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  category: string | null;
  note: string | null;
};

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function requireAdminContext() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id || !isAdminUser(session)) {
    throw new Error("Unauthorized");
  }

  const membership = await prisma.villageMembership.findFirst({
    where: {
      userId: session.id,
      status: "ACTIVE",
      role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] },
    },
    select: { villageId: true },
  });

  if (!membership) {
    throw new Error("Unauthorized");
  }

  return { session, villageId: membership.villageId };
}

async function getReviewNotification(notificationId: string, adminUserId: string) {
  const row = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: {
      id: true,
      userId: true,
      villageId: true,
      metadata: true,
    },
  });

  if (!row || row.userId !== adminUserId) {
    throw new Error("ไม่พบคำขอ");
  }

  const metadata = row.metadata as Record<string, unknown> | null;
  if (metadata?.source !== "RESIDENT_CONTACT_REQUEST_REVIEW") {
    throw new Error("คำขอไม่ถูกต้อง");
  }

  return {
    row,
    metadata,
    requestId: typeof metadata?.requestId === "string" ? metadata.requestId : "",
    trackingNotificationId:
      typeof metadata?.trackingNotificationId === "string" ? metadata.trackingNotificationId : "",
    payload: (metadata?.payload ?? null) as RequestPayload | null,
    requesterId: typeof metadata?.requesterId === "string" ? metadata.requesterId : null,
  };
}

export async function approveResidentContactRequestAction(formData: FormData) {
  const { session, villageId } = await requireAdminContext();
  const notificationId = readText(formData, "notificationId");

  if (!notificationId) {
    throw new Error("ไม่พบคำขอ");
  }

  const { metadata, requestId, trackingNotificationId, payload } = await getReviewNotification(notificationId, session.id);

  if (!requestId || !payload || !payload.name || !payload.phone) {
    throw new Error("ข้อมูลคำขอไม่ครบถ้วน");
  }

  const created = await prisma.contactDirectory.create({
    data: {
      villageId,
      name: payload.name,
      role: payload.role ?? undefined,
      phone: payload.phone,
      email: payload.email ?? undefined,
      address: payload.address ?? undefined,
      category: payload.category ?? undefined,
      isPublic: false,
      sortOrder: 0,
    },
    select: { id: true },
  });

  await prisma.notification.updateMany({
    where: {
      villageId,
      metadata: {
        path: ["source"],
        equals: "RESIDENT_CONTACT_REQUEST_REVIEW",
      },
      AND: [
        {
          metadata: {
            path: ["requestId"],
            equals: requestId,
          },
        },
      ],
    },
    data: {
      status: NotificationStatus.ARCHIVED,
      readAt: new Date(),
    },
  });

  if (trackingNotificationId) {
    await prisma.notification.update({
      where: { id: trackingNotificationId },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
        title: "คำขอเพิ่มผู้ติดต่อได้รับการอนุมัติ",
        metadata: {
          ...metadata,
          source: "RESIDENT_CONTACT_REQUEST_TRACKING",
          workflowStatus: "APPROVED",
          approvedContactId: created.id,
          reviewedByName: session.name,
        },
      },
    });
  }

  await prisma.notification.create({
    data: {
      userId: session.id,
      villageId,
      type: NotificationType.SYSTEM,
      title: "อนุมัติคำขอเพิ่มผู้ติดต่อแล้ว",
      body: `เพิ่มรายชื่อ ${payload.name} สำเร็จ`,
      metadata: {
        source: "RESIDENT_CONTACT_REQUEST_AUDIT",
        requestId,
        contactId: created.id,
      },
    },
  });

  revalidatePath("/admin/contacts");
  revalidatePath("/admin/contacts/requests");
  revalidatePath("/resident/contacts");
  revalidatePath("/resident/contacts/requests");
}

export async function rejectResidentContactRequestAction(formData: FormData) {
  const { session, villageId } = await requireAdminContext();
  const notificationId = readText(formData, "notificationId");
  const reason = readText(formData, "reason");

  if (!notificationId) {
    throw new Error("ไม่พบคำขอ");
  }

  const { metadata, requestId, trackingNotificationId } = await getReviewNotification(notificationId, session.id);

  await prisma.notification.updateMany({
    where: {
      villageId,
      metadata: {
        path: ["source"],
        equals: "RESIDENT_CONTACT_REQUEST_REVIEW",
      },
      AND: [
        {
          metadata: {
            path: ["requestId"],
            equals: requestId,
          },
        },
      ],
    },
    data: {
      status: NotificationStatus.ARCHIVED,
      readAt: new Date(),
    },
  });

  if (trackingNotificationId) {
    await prisma.notification.update({
      where: { id: trackingNotificationId },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
        title: "คำขอเพิ่มผู้ติดต่อไม่ได้รับการอนุมัติ",
        metadata: {
          ...metadata,
          source: "RESIDENT_CONTACT_REQUEST_TRACKING",
          workflowStatus: "REJECTED",
          reviewedByName: session.name,
          rejectReason: reason || null,
        },
      },
    });
  }

  revalidatePath("/admin/contacts/requests");
  revalidatePath("/resident/contacts/requests");
}

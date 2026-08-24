"use server";

import { randomUUID } from "crypto";
import { NotificationType, VillageMembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { isContactCategory, validateContactPhone } from "@/lib/contact";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";

const ADMIN_ROLES: VillageMembershipRole[] = [
  VillageMembershipRole.HEADMAN,
  VillageMembershipRole.ASSISTANT_HEADMAN,
  VillageMembershipRole.COMMITTEE,
];

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

type ContactRequestField = "name" | "phone" | "category";
type ContactRequestResult =
  | { success: true; requestId: string }
  | { success: false; error: string; field?: ContactRequestField };

export async function createResidentContactRequestAction(formData: FormData): Promise<ContactRequestResult> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    return { success: false, error: "กรุณาเข้าสู่ระบบ" };
  }

  const membership = getResidentMembership(session);
  if (!membership) {
    return { success: false, error: "ไม่พบหมู่บ้านของคุณ" };
  }

  const name = readText(formData, "name");
  const role = readText(formData, "role");
  const phone = readText(formData, "phone");
  const email = readText(formData, "email");
  const address = readText(formData, "address");
  const category = readText(formData, "category");
  const note = readText(formData, "note");

  if (name.length < 2) {
    return { success: false, error: "กรุณาระบุชื่อผู้ติดต่ออย่างน้อย 2 ตัวอักษร", field: "name" };
  }
  const phoneError = validateContactPhone(phone);
  if (phoneError) {
    return { success: false, error: phoneError, field: "phone" };
  }
  if (category && !isContactCategory(category)) {
    return { success: false, error: "หมวดหมู่ผู้ติดต่อไม่ถูกต้อง", field: "category" };
  }

  const requestId = randomUUID();

  const trackingNotification = await prisma.$transaction(async (tx) => {
    const request = await tx.contactRequest.create({
      data: {
        id: requestId,
        villageId: membership.villageId,
        requesterId: session.id,
        name,
        role: role || null,
        phone,
        email: email || null,
        address: address || null,
        category: category || null,
        note: note || null,
      },
    });

    const tracking = await tx.notification.create({ data: {
      userId: session.id,
      villageId: membership.villageId,
      type: NotificationType.SYSTEM,
      title: "ส่งคำขอเพิ่มผู้ติดต่อแล้ว",
      body: `${name} (${phone})`,
      metadata: {
        source: "RESIDENT_CONTACT_REQUEST_TRACKING",
        requestId,
        workflowStatus: "PENDING",
        payload: {
          name,
          role: role || null,
          phone,
          email: email || null,
          address: address || null,
          category: category || null,
          note: note || null,
        },
      },
    }, select: { id: true } });

  const admins = await prisma.villageMembership.findMany({
    where: {
      villageId: membership.villageId,
      status: "ACTIVE",
      role: { in: ADMIN_ROLES },
    },
    distinct: ["userId"],
    select: { userId: true },
  });

  if (admins.length > 0) {
    await tx.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.userId,
        villageId: membership.villageId,
        type: NotificationType.SYSTEM,
        title: "มีคำขอเพิ่มผู้ติดต่อจากลูกบ้าน",
        body: `${session.name} ส่งคำขอ: ${name} (${phone})`,
        metadata: {
          source: "RESIDENT_CONTACT_REQUEST_REVIEW",
          requestId,
          requesterId: session.id,
          requesterName: session.name,
          trackingNotificationId: tracking.id,
          payload: {
            name,
            role: role || null,
            phone,
            email: email || null,
            address: address || null,
            category: category || null,
            note: note || null,
          },
        },
      })),
    }); }
    return { id: tracking.id, requestId: request.id };
  });

  revalidatePath("/resident/contacts");
  revalidatePath("/resident/contacts/requests");
  return { success: true, requestId: trackingNotification.requestId };
}

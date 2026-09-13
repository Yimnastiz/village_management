"use server";

import { randomUUID } from "crypto";
import { MembershipStatus, NotificationType, VillageMembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSystemSettings } from "@/lib/system-settings";
import { ConfiguredVillageError, getConfiguredVillage } from "@/lib/configured-village";
import { createFeedbackTitle } from "@/app/(admin)/admin/feedback/feedback-presentation";

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function submitPublicFeedbackAction(formData: FormData): Promise<{ success: true } | { success: false; error: string }> {
  if (!(await getSystemSettings()).publicFeedbackEnabled) {
    return { success: false, error: "ขณะนี้ปิดรับความคิดเห็นชั่วคราว" };
  }
  const name = readText(formData, "name");
  const email = readText(formData, "email");
  const category = readText(formData, "category");
  const detail = readText(formData, "detail");

  if (!category) {
    return { success: false, error: "กรุณาเลือกประเภท" };
  }

  if (!detail || detail.length < 10) {
    return { success: false, error: "กรุณากรอกรายละเอียดอย่างน้อย 10 ตัวอักษร" };
  }

  let village;
  try {
    village = await getConfiguredVillage();
  } catch (error) {
    if (error instanceof ConfiguredVillageError) {
      return { success: false, error: "ระบบยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ" };
    }
    throw error;
  }

  const headmen = await prisma.villageMembership.findMany({
    where: { villageId: village.id, role: VillageMembershipRole.HEADMAN, status: MembershipStatus.ACTIVE },
    select: { userId: true, villageId: true },
  });

  if (headmen.length === 0) {
    return { success: true };
  }

  const feedbackId = randomUUID();
  await prisma.notification.createMany({
    data: headmen.map((headman) => ({
      userId: headman.userId,
      villageId: headman.villageId,
      type: NotificationType.SYSTEM,
      title: createFeedbackTitle(detail),
      body: detail,
      metadata: {
        source: "PUBLIC_FEEDBACK",
        feedbackId,
        name: name || null,
        email: email || null,
        category,
      },
    })),
  });

  return { success: true };
}

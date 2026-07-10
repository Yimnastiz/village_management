"use server";

import { randomUUID } from "crypto";
import { NotificationType, SystemRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function submitPublicFeedbackAction(formData: FormData): Promise<{ success: true } | { success: false; error: string }> {
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

  const superAdmins = await prisma.user.findMany({
    where: { systemRole: SystemRole.SUPERADMIN },
    select: { id: true },
  });

  if (superAdmins.length === 0) {
    return { success: true };
  }

  const feedbackId = randomUUID();
  await prisma.notification.createMany({
    data: superAdmins.map((admin) => ({
      userId: admin.id,
      type: NotificationType.SYSTEM,
      title: `Feedback ใหม่ (${category})`,
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

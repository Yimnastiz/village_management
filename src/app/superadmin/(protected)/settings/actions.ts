"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminActionSession, writeSuperAdminAuditLog } from "@/lib/superadmin";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function upsertGlobalSettingAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();

  const settingKey = readString(formData, "settingKey");
  const settingValue = readString(formData, "settingValue");

  if (!settingKey) {
    throw new Error("กรุณาระบุคีย์การตั้งค่า");
  }

  await prisma.fAQItem.upsert({
    where: {
      id: readString(formData, "id") || "__new__",
    },
    update: {
      question: settingKey,
      answer: settingValue,
      category: "GLOBAL_SETTING",
      isPublic: false,
      villageId: null,
    },
    create: {
      question: settingKey,
      answer: settingValue,
      category: "GLOBAL_SETTING",
      isPublic: false,
      villageId: null,
    },
  }).catch(async () => {
    const existing = await prisma.fAQItem.findFirst({
      where: {
        category: "GLOBAL_SETTING",
        villageId: null,
        question: settingKey,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.fAQItem.update({
        where: { id: existing.id },
        data: { answer: settingValue },
      });
    } else {
      await prisma.fAQItem.create({
        data: {
          question: settingKey,
          answer: settingValue,
          category: "GLOBAL_SETTING",
          isPublic: false,
          villageId: null,
        },
      });
    }
  });

  await writeSuperAdminAuditLog({
    action: AuditAction.UPDATE,
    resource: "GlobalSetting",
    resourceId: settingKey,
  });

  revalidatePath("/superadmin/settings");
}

export async function deleteGlobalSettingAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();

  const id = readString(formData, "id");
  if (!id) {
    throw new Error("ไม่พบรายการตั้งค่า");
  }

  const deleted = await prisma.fAQItem.delete({
    where: { id },
    select: { question: true },
  });

  await writeSuperAdminAuditLog({
    action: AuditAction.DELETE,
    resource: "GlobalSetting",
    resourceId: deleted.question,
  });

  revalidatePath("/superadmin/settings");
}

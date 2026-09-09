"use server";

import { revalidatePath } from "next/cache";
import { requireVillageActionPermission } from "@/lib/admin-permission.server";
import { transitionFeedback } from "@/features/feedback/server/feedback-service";

export async function updateAdminFeedbackStatusAction(formData: FormData) {
  const context = await requireVillageActionPermission("feedback.manage");
  const feedbackId = typeof formData.get("feedbackId") === "string" ? String(formData.get("feedbackId")).trim() : "";
  const operation = formData.get("operation");
  if (!feedbackId || !["unread", "archive", "restore"].includes(String(operation))) throw new Error("ข้อมูลรายการไม่ถูกต้อง");
  await transitionFeedback(feedbackId, operation as "unread" | "archive" | "restore", context.villageId);
  revalidatePath("/admin/feedback");
  revalidatePath(`/admin/feedback/${feedbackId}`);
}

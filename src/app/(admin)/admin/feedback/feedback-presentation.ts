import { NotificationStatus } from "@prisma/client";

export const categoryOptions = [
  { value: "all", label: "ทั้งหมด" },
  { value: "suggestion", label: "ข้อเสนอแนะ" },
  { value: "complaint", label: "ข้อร้องเรียน" },
  { value: "bug", label: "รายงานข้อผิดพลาด" },
  { value: "other", label: "อื่น ๆ" },
] as const;

const LEGACY_FEEDBACK_TITLE_PATTERN = /^Feedback ใหม่\s*\([^)]*\)$/i;
const FEEDBACK_TITLE_MAX_LENGTH = 80;

export function createFeedbackTitle(detail: string) {
  const firstMeaningfulLine = detail.split(/\r?\n/).find((line) => line.trim());
  const normalized = firstMeaningfulLine?.trim().replace(/\s+/g, " ") ?? "";
  if (normalized.length <= FEEDBACK_TITLE_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, FEEDBACK_TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}

export function feedbackDisplayTitle(title: string | null, body: string | null) {
  const storedTitle = title?.trim() ?? "";
  if (storedTitle && !LEGACY_FEEDBACK_TITLE_PATTERN.test(storedTitle)) return storedTitle;
  return createFeedbackTitle(body ?? "") || "ความคิดเห็นจากผู้ใช้งาน";
}

export function feedbackBodyPreview(body: string | null) {
  const lines = (body ?? "").split(/\r?\n/);
  const firstMeaningfulLineIndex = lines.findIndex((line) => line.trim());
  if (firstMeaningfulLineIndex < 0) return "";
  return lines.slice(firstMeaningfulLineIndex + 1).join("\n").trim();
}

export const statusLabels: Record<NotificationStatus, string> = {
  UNREAD: "ยังไม่ได้อ่าน",
  READ: "อ่านแล้ว",
  ARCHIVED: "จัดเก็บแล้ว",
};

export function categoryLabel(category: string | null) {
  return categoryOptions.find((option) => option.value === category)?.label ?? "อื่น ๆ";
}

export function categoryClassName(category: string | null) {
  switch (category) {
    case "suggestion": return "bg-emerald-50 text-emerald-700";
    case "complaint": return "bg-amber-50 text-amber-700";
    case "bug": return "bg-rose-50 text-rose-700";
    default: return "bg-gray-100 text-gray-600";
  }
}

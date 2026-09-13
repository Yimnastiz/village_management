import { NotificationStatus } from "@prisma/client";

export const categoryOptions = [
  { value: "all", label: "ทุกประเภท" },
  { value: "suggestion", label: "ข้อเสนอแนะ" },
  { value: "complaint", label: "ข้อร้องเรียน" },
  { value: "bug", label: "รายงานข้อผิดพลาด" },
  { value: "other", label: "อื่น ๆ" },
] as const;

export const statusLabels: Record<NotificationStatus, string> = {
  UNREAD: "ยังไม่ได้อ่าน",
  READ: "อ่านแล้ว",
  ARCHIVED: "เก็บถาวร",
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

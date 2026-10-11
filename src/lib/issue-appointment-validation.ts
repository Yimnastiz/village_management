import { z } from "zod";

export const ISSUE_CATEGORY_VALUES = ["ROAD", "WATER", "ELECTRICITY", "WASTE", "SECURITY", "PUBLIC_HEALTH", "ENVIRONMENT", "OTHER"] as const;
export const ISSUE_PRIORITY_VALUES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const ISSUE_STAGE_VALUES = ["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED", "REJECTED"] as const;
export const APPOINTMENT_STAGE_VALUES = ["PENDING_APPROVAL", "TIME_SUGGESTED", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED"] as const;

export const issueTitleSchema = z.string().trim().min(5, "หัวข้อต้องมีอย่างน้อย 5 ตัวอักษร");
export const issueDescriptionSchema = z.string().trim().min(10, "รายละเอียดต้องมีอย่างน้อย 10 ตัวอักษร");
export const issueCategorySchema = z.enum(ISSUE_CATEGORY_VALUES, { message: "หมวดหมู่ไม่ถูกต้อง" });
export const issuePrioritySchema = z.enum(ISSUE_PRIORITY_VALUES, { message: "ระดับความสำคัญไม่ถูกต้อง" });
export const issueStageSchema = z.enum(ISSUE_STAGE_VALUES, { message: "สถานะไม่ถูกต้อง" });

export const appointmentTitleSchema = z.string().trim().min(3, "ชื่อนัดหมายต้องมีความยาวอย่างน้อย 3 ตัวอักษร");
export const appointmentStageSchema = z.enum(APPOINTMENT_STAGE_VALUES, { message: "สถานะนัดหมายไม่ถูกต้อง" });
export const rejectionNoteSchema = z.string().trim().min(5, "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
export const suggestedTimeMessageSchema = z.string().trim().max(500, "ข้อความต้องไม่เกิน 500 ตัวอักษร").optional();
export const appointmentTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "เวลาไม่ถูกต้อง");

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseAppointmentDate(value: string, today = new Date()): { ok: true; date: Date } | { ok: false; error: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return { ok: false, error: "วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD" };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { ok: false, error: "วันที่นัดหมายไม่ถูกต้อง" };
  }
  if (value < localDateKey(today)) return { ok: false, error: "วันที่นัดหมายต้องไม่เป็นวันในอดีต" };
  return { ok: true, date };
}

export const appointmentDateSchema = z.string().refine((value) => parseAppointmentDate(value).ok, {
  message: "วันที่นัดหมายต้องเป็นวันที่จริงในรูปแบบ YYYY-MM-DD และไม่เป็นวันในอดีต",
});

export function isAppointmentDateTodayOrFuture(date: Date, today = new Date()): boolean {
  return date.toISOString().slice(0, 10) >= localDateKey(today);
}

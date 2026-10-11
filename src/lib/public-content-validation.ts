import { z } from "zod";

export const newsTitleSchema = z.string().trim().min(3, "กรุณาระบุหัวข้อข่าว");
export const newsContentSchema = z.string().trim().min(10, "กรุณาระบุเนื้อหาอย่างน้อย 10 ตัวอักษร");
export const eventTitleSchema = z.string().trim().min(3, "กรุณาระบุชื่อกิจกรรม");
export const galleryTitleSchema = z.string().trim().min(2, "กรุณาระบุชื่ออัลบั้ม");
export const transparencyTitleSchema = z.string().trim().min(3, "กรุณาระบุหัวข้อ");

export const newsStageSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"], { message: "สถานะข่าวไม่ถูกต้อง" });
export const newsVisibilitySchema = z.enum(["PUBLIC", "RESIDENT_ONLY"], { message: "ประเภทการแสดงผลไม่ถูกต้อง" });
export const eventVisibilitySchema = z.enum(["PUBLIC", "RESIDENT"], { message: "กรุณาเลือกการมองเห็น" });
export const galleryVisibilitySchema = z.enum(["PUBLIC", "RESIDENT"], { message: "กรุณาเลือกการมองเห็น" });
export const residentSubmissionOptionSchema = z.enum(["ALLOW", "DISALLOW"], { message: "กรุณาเลือกการรับคำขอเพิ่มรูป" });

export function normalizeFiscalYear(value: string): string {
  return value.trim().replace(/[\u0E50-\u0E59]/g, (digit) => String(digit.charCodeAt(0) - 0x0e50));
}

export function validateFiscalYear(value: string): string | null {
  const normalized = normalizeFiscalYear(value);
  if (!normalized) return null;
  return /^\d{4}$/.test(normalized) ? null : "ปีงบประมาณต้องเป็นตัวเลข 4 หลัก";
}

export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

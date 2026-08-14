import { z } from "zod";
import { MAX_DOWNLOAD_ATTACHMENT_BYTES, MAX_DOWNLOAD_ATTACHMENTS } from "@/lib/download-upload";
import { DOWNLOAD_CATEGORY_OPTIONS } from "./constants";

const categoryKeys = DOWNLOAD_CATEGORY_OPTIONS.map((option) => option.value) as [string, ...string[]];

export const downloadAttachmentSchema = z.object({
  id: z.string().cuid().optional(),
  fileName: z.string().trim().min(1).max(255).optional(),
  fileKey: z.string().trim().min(1).optional(),
  fileUrl: z.string().trim().min(1).optional(),
  fileSize: z.number().int().positive().max(MAX_DOWNLOAD_ATTACHMENT_BYTES).optional(),
  mimeType: z.string().trim().min(1).max(255).optional(),
  uploadToken: z.string().trim().min(1).optional(),
});

export const downloadFormSchema = z.object({
  title: z.string().trim().min(3, "กรุณาระบุชื่อเอกสาร").max(255),
  description: z.string().trim().max(5000).optional(),
  category: z.enum(categoryKeys, { message: "กรุณาเลือกหมวดหมู่" }),
  categoryLabel: z.string().trim().max(100).optional(),
  visibility: z.enum(["PUBLIC", "RESIDENT_ONLY"], { message: "กรุณาเลือกการมองเห็น" }),
  attachments: z.array(downloadAttachmentSchema).min(1, "กรุณาเพิ่มไฟล์เอกสารอย่างน้อย 1 ไฟล์").max(MAX_DOWNLOAD_ATTACHMENTS, `เพิ่มไฟล์ได้สูงสุด ${MAX_DOWNLOAD_ATTACHMENTS} ไฟล์`),
});

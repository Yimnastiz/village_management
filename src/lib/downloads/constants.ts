export const DOWNLOAD_STAGE_LABELS: Record<string, string> = {
  DRAFT: "ร่าง",
  PUBLISHED: "เผยแพร่แล้ว",
  ARCHIVED: "จัดเก็บ",
};

export const DOWNLOAD_CATEGORY_OPTIONS = [
  { value: "FORM", label: "แบบฟอร์ม/คำร้อง" },
  { value: "ANNOUNCEMENT", label: "ประกาศ/หนังสือแจ้ง" },
  { value: "REGULATION", label: "ระเบียบ/ข้อบังคับ" },
  { value: "REPORT", label: "รายงาน/รายงานประชุม" },
  { value: "FINANCE", label: "การเงิน/งบประมาณ" },
  { value: "PROJECT", label: "โครงการ/แผนงาน" },
  { value: "HEALTH", label: "สาธารณสุข" },
  { value: "WELFARE", label: "สวัสดิการ/สิทธิประโยชน์" },
  { value: "POPULATION", label: "ทะเบียน/ข้อมูลประชากร" },
  { value: "GOVERNMENT", label: "เอกสารราชการ" },
  { value: "GUIDE", label: "คู่มือ/แนวทาง" },
  { value: "OTHER", label: "อื่น ๆ" },
] as const;

export const DOWNLOAD_CATEGORY_LABELS = Object.fromEntries(
  DOWNLOAD_CATEGORY_OPTIONS.map((option) => [option.value, option.label])
) as Record<string, string>;

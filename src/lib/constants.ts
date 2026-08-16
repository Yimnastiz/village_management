export { ISSUE_STAGE_LABELS } from "@/lib/issues/status";
export { ISSUE_PRIORITY_LABELS } from "@/lib/issues/priority";

export const ISSUE_CATEGORY_LABELS: Record<string, string> = {
  ROAD: "ถนน/ทางสาธารณะ",
  WATER: "น้ำประปา/แหล่งน้ำ",
  ELECTRICITY: "ไฟฟ้า",
  WASTE: "ขยะ/สิ่งปฏิกูล",
  SECURITY: "ความปลอดภัย",
  PUBLIC_HEALTH: "สาธารณสุข",
  ENVIRONMENT: "สิ่งแวดล้อม",
  OTHER: "อื่นๆ",
};

export const APPOINTMENT_STAGE_LABELS: Record<string, string> = {
    PENDING_APPROVAL: "รอผู้ใหญ่บ้านตอบกลับ",
    TIME_SUGGESTED: "รอคุณยืนยันวันเวลา",
    APPROVED: "ยืนยันนัดหมายแล้ว",
  REJECTED: "ปฏิเสธ",
  CANCELLED: "ยกเลิก",
  COMPLETED: "เสร็จสิ้น",
};

export const NEWS_STAGE_LABELS: Record<string, string> = {
  DRAFT: "ร่าง",
  PUBLISHED: "เผยแพร่แล้ว",
  ARCHIVED: "เก็บถาวร",
};

export const NEWS_VISIBILITY_LABELS: Record<string, string> = {
  PUBLIC: "สาธารณะ",
  RESIDENT_ONLY: "เฉพาะลูกบ้าน",
};

export const NEWS_SUBMISSION_TYPE_LABELS: Record<string, string> = {
  CREATE: "ขอเพิ่มข่าวใหม่",
  UPDATE: "ขอแก้ไขข่าว",
};

export const NEWS_SUBMISSION_STATUS_LABELS: Record<string, string> = {
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
};

export const NEWS_AUTHOR_SOURCE_LABELS: Record<string, string> = {
  ADMIN: "โดยแอดมิน",
  RESIDENT: "โดยลูกบ้าน",
  UNKNOWN: "ไม่ระบุผู้สร้าง",
};

export const VILLAGE_EVENT_SUBMISSION_STATUS_LABELS: Record<string, string> = {
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
};

export const VILLAGE_EVENT_VISIBILITY_LABELS: Record<string, string> = {
  PUBLIC: "สาธารณะ",
  RESIDENT: "เฉพาะลูกบ้าน",
};

export const VILLAGE_PLACE_CATEGORY_LABELS: Record<string, string> = {
  TEMPLE: "วัด/ศาสนสถาน",
  SHOP: "ร้านค้า/ตลาด",
  FOOD: "ร้านอาหาร/เครื่องดื่ม",
  SERVICE: "บริการ/ร้านซ่อม",
  SCHOOL: "โรงเรียน/การศึกษา",
  CLINIC: "สุขภาพ/คลินิก",
  GOVERNMENT: "หน่วยงานราชการ",
  COMMUNITY: "สถานที่ชุมชน",
  AGRICULTURE: "เกษตร/ปศุสัตว์",
  ACCOMMODATION: "ที่พัก",
  TRANSPORT: "คมนาคม/ขนส่ง",
  OTHER: "อื่น ๆ",
};

export const VILLAGE_PLACE_SUBMISSION_STATUS_LABELS: Record<string, string> = {
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
};

export const VILLAGE_PLACE_SUBMISSION_TYPE_LABELS: Record<string, string> = {
  CREATE: "ขอเพิ่มสถานที่",
  UPDATE: "ขอแก้ไขสถานที่",
};

export const MEMBERSHIP_ROLE_LABELS: Record<string, string> = {
  HEADMAN: "ผู้ใหญ่บ้าน",
  ASSISTANT_HEADMAN: "ผู้ช่วยผู้ใหญ่บ้าน",
  COMMITTEE: "คณะกรรมการหมู่บ้าน",
  RESIDENT: "ลูกบ้าน",
};

export const MEMBERSHIP_STATUS_LABELS: Record<string, string> = {
  PENDING: "รอการอนุมัติ",
  ACTIVE: "ใช้งานอยู่",
  SUSPENDED: "ระงับการใช้งาน",
  REJECTED: "ปฏิเสธ",
};

export const CORRECTION_STATUS_LABELS: Record<string, string> = {
  PENDING: "รอการพิจารณา",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ปฏิเสธ",
  CANCELLED: "ยกเลิก",
};

export const TRANSPARENCY_STAGE_LABELS: Record<string, string> = {
  DRAFT: "ร่าง",
  PUBLISHED: "เผยแพร่แล้ว",
  ARCHIVED: "เก็บถาวร",
};

export const FEEDBACK_RATING_LABELS: Record<string, string> = {
  VERY_SATISFIED: "พึงพอใจมาก",
  SATISFIED: "พึงพอใจ",
  NEUTRAL: "เฉยๆ",
  DISSATISFIED: "ไม่พึงพอใจ",
  VERY_DISSATISFIED: "ไม่พึงพอใจมาก",
};

export const EMERGENCY_TYPE_LABELS: Record<string, string> = {
  FIRE: "ไฟไหม้",
  FLOOD: "น้ำท่วม",
  ACCIDENT: "อุบัติเหตุ",
  MEDICAL: "ฉุกเฉินทางการแพทย์",
  CRIME: "อาชญากรรม",
  OTHER: "อื่นๆ",
};

export const PERSON_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "มีชีวิตอยู่",
  DECEASED: "เสียชีวิต",
  MOVED_OUT: "ย้ายออก",
  UNKNOWN: "ไม่ทราบ",
};

export const OCCUPANCY_STATUS_LABELS: Record<string, string> = {
  OCCUPIED: "มีผู้อยู่อาศัย",
  VACANT: "ว่าง",
  UNDER_CONSTRUCTION: "กำลังก่อสร้าง",
  DEMOLISHED: "รื้อถอนแล้ว",
};

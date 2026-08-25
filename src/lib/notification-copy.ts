import type { Prisma } from "@prisma/client";

/** Stable module identifiers for new notifications. Legacy source values remain supported by readers. */
export const NOTIFICATION_SOURCES = ["NEWS", "ISSUE", "APPOINTMENT", "CALENDAR", "CONTACT", "GALLERY", "PLACE", "DOWNLOAD", "TRANSPARENCY", "HOUSEHOLD", "BINDING", "SYSTEM"] as const;
export type NotificationSource = (typeof NOTIFICATION_SOURCES)[number];
export type NotificationRequestType = "CREATE" | "UPDATE" | "DELETE" | "EDIT";

const MODULE_NOUN: Record<NotificationSource, string> = {
  NEWS: "ข่าว", ISSUE: "ปัญหา", APPOINTMENT: "นัดหมาย", CALENDAR: "กิจกรรม", CONTACT: "ผู้ติดต่อ", GALLERY: "รูปภาพ", PLACE: "สถานที่", DOWNLOAD: "เอกสาร", TRANSPARENCY: "ข้อมูลความโปร่งใส", HOUSEHOLD: "ครัวเรือน", BINDING: "คำขอผูกเลขบ้าน", SYSTEM: "ระบบ",
};

function requestVerb(type: NotificationRequestType) {
  return type === "DELETE" ? "ลบ" : type === "UPDATE" || type === "EDIT" ? "แก้ไข" : "เพิ่ม";
}

export function notificationMetadata<T extends Prisma.InputJsonObject>(source: NotificationSource, metadata: T): T & { source: NotificationSource } {
  return { ...metadata, source };
}

export function residentRequestCopy(input: { source: NotificationSource; requestType: NotificationRequestType; status: "SUBMITTED" | "APPROVED" | "REJECTED"; entityName?: string | null; reason?: string | null }) {
  const noun = MODULE_NOUN[input.source];
  const request = `คำขอ${requestVerb(input.requestType)}${noun}`;
  if (input.status === "SUBMITTED") return { title: `ส่ง${request}แล้ว`, body: input.entityName ? `“${input.entityName}” รอการตรวจสอบ` : "คำขออยู่ระหว่างการตรวจสอบ" };
  if (input.status === "APPROVED") return { title: `${request}ได้รับการอนุมัติ`, body: input.entityName ? `“${input.entityName}” ดำเนินการแล้ว` : "ดำเนินการตามคำขอแล้ว" };
  return { title: `${request}ไม่ได้รับการอนุมัติ`, body: `เหตุผล: ${input.reason?.trim() || "ไม่ระบุเหตุผล"}` };
}

export function adminRequestCopy(input: { source: NotificationSource; requestType: NotificationRequestType; entityName?: string | null; requesterName?: string | null }) {
  const noun = MODULE_NOUN[input.source];
  const title = `มีคำขอ${requestVerb(input.requestType)}${noun}ใหม่`;
  const body = input.entityName ? `“${input.entityName}”${input.requesterName ? ` จาก ${input.requesterName}` : ""}` : input.requesterName ? `จาก ${input.requesterName}` : "รอการตรวจสอบ";
  return { title, body };
}

export function issueUpdateCopy(input: { issueTitle?: string | null; statusLabel?: string | null }) {
  return { title: "ปัญหาที่แจ้งมีการอัปเดต", body: input.statusLabel ? `สถานะเปลี่ยนเป็น “${input.statusLabel}”` : input.issueTitle ? `“${input.issueTitle}” มีข้อมูลอัปเดต` : "มีข้อมูลอัปเดต" };
}

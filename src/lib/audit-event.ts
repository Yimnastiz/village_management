import type { AuditAction, Prisma } from "@prisma/client";
import { getLegacyActorRoleLabel } from "@/lib/legacy-actor-role";

export type AuditEventCategory = "CREATE" | "UPDATE" | "DELETE" | "REVIEW" | "AUTH" | "SECURITY";
export type AuditEventTone = "success" | "info" | "danger" | "warning" | "neutral";
export type AuditEventIcon = "plus" | "pencil" | "trash" | "check" | "x" | "login" | "shield" | "user-cog";

type AuditInput = {
  action: AuditAction;
  resource: string;
  metadata?: Prisma.JsonValue | null;
};

export type FormattedAuditEvent = {
  label: string;
  category: AuditEventCategory;
  tone: AuditEventTone;
  icon: AuditEventIcon;
  resourceLabel: string;
  actorRole: string | null;
  targetFromMetadata: string | null;
  changes: Array<{ label: string; before: string | null; after: string | null }>;
  reason: string | null;
  isSuperAdminIntervention: boolean;
};

export const IMPORTANT_AUDIT_RESOURCES = [
  "Village", "VillageStatus", "UserSystemRole", "VillageAdminRoleAssignment", "VillageAdminRoleRemoval",
  "UserMembershipSuspension", "UserProfile", "UserMembership", "UserAccount", "GlobalSetting", "SystemSettings", "SystemWideBroadcast", "VillageBroadcast",
] as const;

/** Business-facing resource groups used by investigation tools. Values remain technical internally. */
export const AUDIT_MODULE_RESOURCES: Record<string, readonly string[]> = {
  VILLAGE: ["Village", "VillageStatus"],
  ACCOUNTS: ["UserAccount", "UserSystemRole", "UserProfile"],
  MEMBERS: ["VillageMembership", "VillageAdminRoleAssignment", "VillageAdminRoleRemoval", "VillageAdminSupport", "MembershipSupport", "UserMembership", "UserMembershipSuspension"],
  POPULATION: ["Person", "PopulationImportJob", "PopulationExport"],
  HOUSEHOLD: ["House"], BINDING: ["BindingRequest", "BindingRequestSupport"],
  NEWS: ["News", "NewsSubmission"], CALENDAR: ["VillageEvent", "VillageEventSubmission"], APPOINTMENT: ["Appointment"],
  ISSUE: ["Issue"], GALLERY: ["GalleryAlbum", "GalleryItem", "GalleryItemSubmission"], PLACE: ["VillagePlace", "VillagePlaceSubmission"],
  DOWNLOAD: ["DownloadFile"], TRANSPARENCY: ["TransparencyRecord"],
  SETTINGS: ["ContactDirectory", "ContactRequest", "GlobalSetting", "SystemSettings", "SystemWideBroadcast", "VillageBroadcast"],
};

export function auditResourcesForModule(module: string) {
  return AUDIT_MODULE_RESOURCES[module] ?? [];
}

export function auditModuleLabel(module: string) {
  return ({ VILLAGE: "หมู่บ้าน", ACCOUNTS: "บัญชีผู้ใช้", MEMBERS: "สมาชิกและบทบาท", POPULATION: "ทะเบียนประชากร", HOUSEHOLD: "บ้านและครัวเรือน", BINDING: "การผูกเลขที่บ้าน", NEWS: "ข่าวสาร", CALENDAR: "ปฏิทิน", APPOINTMENT: "นัดหมาย", ISSUE: "แจ้งปัญหา", GALLERY: "แกลเลอรี", PLACE: "สถานที่", DOWNLOAD: "เอกสารดาวน์โหลด", TRANSPARENCY: "ความโปร่งใส", SETTINGS: "การตั้งค่าระบบ" } as Record<string, string>)[module] ?? module;
}

export function auditActorRoleLabel(role?: string | null) {
  return getLegacyActorRoleLabel(role) ?? role ?? null;
}

const resourceLabels: Record<string, string> = {
  News: "ข่าว",
  NewsSubmission: "คำขอข่าว",
  House: "ทะเบียนบ้าน",
  Person: "ข้อมูลบุคคล",
  BindingRequest: "คำขอผูกเลขบ้าน",
  VillagePlace: "สถานที่",
  VillagePlaceSubmission: "คำขอสถานที่",
  GalleryAlbum: "อัลบั้มรูปภาพ",
  GalleryItemSubmission: "คำขอเพิ่มรูปภาพ",
  DownloadFile: "เอกสารดาวน์โหลด",
  VillageEvent: "กิจกรรมปฏิทิน",
  VillageEventSubmission: "คำขอกิจกรรม",
  Issue: "คำร้องปัญหา",
  ContactDirectory: "ข้อมูลผู้ติดต่อ",
  ContactRequest: "คำขอข้อมูลติดต่อ",
  TransparencyRecord: "รายการความโปร่งใส",
  Village: "ข้อมูลหมู่บ้าน",
  UserAccount: "บัญชีผู้ใช้",
  VillageMembership: "สมาชิกหมู่บ้าน",
  MembershipSupport: "สิทธิ์สมาชิก",
  VillageAdminSupport: "บทบาทผู้ดูแลหมู่บ้าน",
  BindingRequestSupport: "คำขอผูกเลขบ้าน",
  Appointment: "นัดหมาย",
  NationalIdClaim: "การยืนยันตัวตน",
  PopulationImportJob: "การนำเข้าข้อมูลประชากร",
  PopulationExport: "การส่งออกข้อมูลประชากร",
};

const investigationResourceLabels: Record<string, string> = {
  SystemSettings: "การตั้งค่าระบบ",
  Village: "หมู่บ้าน", VillageStatus: "สถานะหมู่บ้าน", UserAccount: "บัญชีผู้ใช้", UserProfile: "ข้อมูลผู้ใช้", UserSystemRole: "บทบาทผู้ใช้",
  VillageMembership: "สมาชิกหมู่บ้าน", UserMembership: "สมาชิกหมู่บ้าน", UserMembershipSuspension: "การระงับสมาชิก", VillageAdminRoleAssignment: "การกำหนดบทบาท", VillageAdminRoleRemoval: "การถอดบทบาท", VillageAdminSupport: "บทบาทผู้ดูแลหมู่บ้าน", MembershipSupport: "สมาชิกและบทบาท",
  Person: "ข้อมูลบุคคล", House: "ทะเบียนบ้าน", BindingRequest: "คำขอผูกเลขที่บ้าน", BindingRequestSupport: "คำขอผูกเลขที่บ้าน", News: "ข่าวสาร", NewsSubmission: "คำขอข่าวสาร",
  VillageEvent: "ปฏิทิน", VillageEventSubmission: "คำขอกิจกรรม", Appointment: "นัดหมาย", Issue: "แจ้งปัญหา", GalleryAlbum: "แกลเลอรี", GalleryItem: "รูปภาพในแกลเลอรี", GalleryItemSubmission: "คำขอรูปภาพ",
  VillagePlace: "สถานที่", VillagePlaceSubmission: "คำขอสถานที่", DownloadFile: "เอกสารดาวน์โหลด", TransparencyRecord: "ความโปร่งใส", ContactDirectory: "ข้อมูลการติดต่อ", ContactRequest: "คำขอข้อมูลติดต่อ",
  PopulationImportJob: "การนำเข้าข้อมูลประชากร", PopulationExport: "การส่งออกข้อมูลประชากร", GlobalSetting: "การตั้งค่าระบบ", SystemWideBroadcast: "ประกาศส่วนกลาง", VillageBroadcast: "ประกาศส่วนกลาง",
};

const actionNameLabels: Record<string, string> = {
  SYSTEM_SETTINGS_UPDATED: "เปลี่ยนการตั้งค่าระบบ",
  MEMBER_ROLE_CHANGED: "เปลี่ยนบทบาทของ",
  MEMBER_SUSPENDED: "ระงับการใช้งานของ",
  MEMBER_REACTIVATED: "เปิดใช้งานอีกครั้งให้",
  NEWS_CREATED: "เพิ่มข่าว",
  NEWS_UPDATED: "แก้ไขข่าว",
  NEWS_DELETED: "ลบข่าว",
  NEWS_SUBMISSION_APPROVED: "อนุมัติข่าวที่ลูกบ้านส่ง",
  NEWS_SUBMISSION_REJECTED: "ไม่อนุมัติข่าวที่ลูกบ้านส่ง",
  PLACE_CREATED: "เพิ่มสถานที่",
  PLACE_UPDATED: "แก้ไขข้อมูลสถานที่",
  PLACE_DELETED: "ลบสถานที่",
  PLACE_REQUEST_APPROVED: "อนุมัติคำขอสถานที่",
  PLACE_REQUEST_REJECTED: "ไม่อนุมัติคำขอสถานที่",
  HOUSE_CREATED: "เพิ่มทะเบียนบ้าน",
  HOUSE_BATCH_CREATED: "เพิ่มบ้านหลายหลัง",
  HOUSE_UPDATED: "แก้ไขทะเบียนบ้าน",
  HOUSE_DELETED: "ลบทะเบียนบ้าน",
  HOUSE_CREATED_FROM_VERIFIED_BINDING_REQUEST: "เพิ่มทะเบียนบ้านจากคำขอ",
  PERSON_CREATED: "เพิ่มข้อมูลบุคคล",
  PERSON_UPDATED: "แก้ไขข้อมูลบุคคล",
  PERSON_MOVED_HOUSE: "ย้ายบุคคลไปบ้านใหม่",
  PERSON_MOVED_OUT: "บันทึกการย้ายออก",
  PERSON_MARKED_DECEASED: "บันทึกสถานะเป็นเสียชีวิต",
  BINDING_APPROVED_TO_EXISTING_HOUSE: "อนุมัติคำขอผูกเลขบ้าน",
  BINDING_REJECTED: "ไม่อนุมัติคำขอผูกเลขบ้าน",
  GALLERY_ALBUM_EDIT_SAVED: "แก้ไขอัลบั้มรูปภาพ",
  GALLERY_ITEMS_ADDED: "เพิ่มรูปภาพในอัลบั้ม",
  CONTACT_REQUEST_APPROVED: "อนุมัติคำขอข้อมูลติดต่อ",
  CONTACT_REQUEST_REJECTED: "ไม่อนุมัติคำขอข้อมูลติดต่อ",
  TRANSPARENCY_CREATED: "เพิ่มรายการความโปร่งใส",
  TRANSPARENCY_UPDATED: "แก้ไขรายการความโปร่งใส",
  TRANSPARENCY_PUBLISHED: "เผยแพร่รายการความโปร่งใส",
  TRANSPARENCY_ARCHIVED: "จัดเก็บรายการความโปร่งใส",
  TRANSPARENCY_REPUBLISHED: "นำข้อมูลความโปร่งใสกลับมาเผยแพร่",
  TRANSPARENCY_DRAFT_DELETED: "ลบรายการความโปร่งใส",
};

const fieldLabels: Record<string, string> = {
  maintenanceMode: "โหมดปิดปรับปรุงระบบ",
  maintenanceMessage: "ข้อความขณะปิดปรับปรุง",
  registrationEnabled: "เปิดรับสมัครสมาชิกใหม่",
  publicFeedbackEnabled: "เปิดรับความคิดเห็นจากบุคคลทั่วไป",
  title: "ชื่อเรื่อง",
  name: "ชื่อ",
  status: "สถานะ",
  stage: "สถานะการเผยแพร่",
  visibility: "การมองเห็น",
  role: "บทบาท",
  houseNumber: "บ้านเลขที่",
  address: "ที่อยู่",
  houseNumbers: "บ้านเลขที่",
  isPublic: "การเผยแพร่สู่สาธารณะ",
  isFeatured: "การแนะนำ",
  category: "หมวดหมู่",
  firstName: "ชื่อ",
  lastName: "นามสกุล",
  gender: "เพศ",
  dateOfBirth: "วันเกิด",
  dateOfDeath: "วันที่เสียชีวิต",
  phone: "เบอร์โทรสำหรับติดต่อ",
  email: "อีเมลสำหรับติดต่อ",
  description: "คำอธิบายหมู่บ้าน",
  website: "เว็บไซต์",
  accountStatus: "สถานะบัญชี",
};

const valueLabels: Record<string, string> = {
  true: "เปิดใช้งาน",
  false: "ปิดใช้งาน",
  ACTIVE: "ใช้งานอยู่",
  SUSPENDED: "ระงับการใช้งาน",
  PENDING: "รอดำเนินการ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
  MOVED_OUT: "ย้ายออก",
  DECEASED: "เสียชีวิต",
  UNKNOWN: "ไม่ทราบสถานะ",
  MALE: "ชาย",
  FEMALE: "หญิง",
  HEADMAN: "ผู้ใหญ่บ้าน",
  ASSISTANT_HEADMAN: "ผู้ช่วยผู้ใหญ่บ้าน",
  RESIDENT: "ลูกบ้าน",
  SUPERADMIN: "ผู้ดูแลระบบระดับสูง",
  SUSPEND: "ระงับสมาชิก",
  ACTIVATE: "เปิดใช้งาน",
};

function asObject(value: Prisma.JsonValue | null | undefined): Record<string, Prisma.JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, Prisma.JsonValue> : {};
}

function text(value: Prisma.JsonValue | undefined): string | null {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "ใช่" : "ไม่ใช่";
  return null;
}

function displayValue(value: Prisma.JsonValue | undefined): string | null {
  const raw = text(value);
  return raw === null ? null : valueLabels[raw] ?? raw;
}

function displayFieldValue(field: string, value: Prisma.JsonValue | undefined): string | null {
  const displayed = displayValue(value);
  if (!displayed || !["dateOfBirth", "dateOfDeath"].includes(field) || !/^\d{4}-\d{2}-\d{2}/.test(displayed)) return displayed;
  const date = new Date(displayed);
  return Number.isNaN(date.getTime()) ? displayed : new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "long", year: "numeric" }).format(date);
}

function classify(action: AuditAction, resource: string): Pick<FormattedAuditEvent, "category" | "tone" | "icon"> {
  if (["LOGIN", "LOGOUT"].includes(action)) return { category: "AUTH", tone: "neutral", icon: "login" };
  if (["APPROVE_RESIDENT_WITH_NATIONAL_ID", "REVOKE_DUPLICATE_NATIONAL_ID_ACCOUNT", "RELEASE_PHONE_FROM_REVOKED_ACCOUNT", "VIEW_SENSITIVE"].includes(action)) return { category: "SECURITY", tone: "warning", icon: "shield" };
  if (resource.includes("Membership") || resource === "UserAccount") return { category: "SECURITY", tone: "warning", icon: "user-cog" };
  if (action === "CREATE") return { category: "CREATE", tone: "success", icon: "plus" };
  if (action === "DELETE" || action === "REJECT") return { category: action === "REJECT" ? "REVIEW" : "DELETE", tone: "danger", icon: action === "REJECT" ? "x" : "trash" };
  if (action === "APPROVE") return { category: "REVIEW", tone: "success", icon: "check" };
  return { category: "UPDATE", tone: "info", icon: "pencil" };
}

function fallbackLabel(action: AuditAction, resourceLabel: string): string {
  const verb: Record<string, string> = {
    CREATE: "เพิ่ม", UPDATE: "แก้ไข", DELETE: "ลบ", APPROVE: "อนุมัติ", REJECT: "ไม่อนุมัติ",
    LOGIN: "เข้าสู่ระบบ", LOGOUT: "ออกจากระบบ", EXPORT: "ส่งออกข้อมูล",
    POPULATION_IMPORT_STARTED: "เริ่มนำเข้าข้อมูลประชากร",
    POPULATION_IMPORT_VALIDATED: "ตรวจสอบไฟล์ข้อมูลประชากร",
    POPULATION_IMPORT_CONFIRMED: "ยืนยันการนำเข้าข้อมูลประชากร",
    POPULATION_IMPORT_COMPLETED: "นำเข้าข้อมูลประชากรสำเร็จ",
    POPULATION_IMPORT_PARTIAL: "นำเข้าข้อมูลประชากรบางส่วน",
    POPULATION_IMPORT_FAILED: "นำเข้าข้อมูลประชากรไม่สำเร็จ",
    POPULATION_IMPORT_ROLLBACK: "ย้อนกลับการนำเข้าข้อมูลประชากร",
    POPULATION_EXPORT_CREATED: "ส่งออกข้อมูลประชากร",
    APPROVE_RESIDENT_WITH_NATIONAL_ID: "ยืนยันตัวตนลูกบ้าน",
    REVOKE_DUPLICATE_NATIONAL_ID_ACCOUNT: "จัดการบัญชีซ้ำ",
    RELEASE_PHONE_FROM_REVOKED_ACCOUNT: "ปลดเบอร์โทรจากบัญชีเดิม",
  };
  const value = verb[action] ?? "บันทึกเหตุการณ์";
  return ["LOGIN", "LOGOUT"].includes(action) ? value : `${value}${resourceLabel ? ` ${resourceLabel}` : ""}`;
}

const actionLabels: Partial<Record<AuditAction, string>> = {
  CREATE: "สร้าง", UPDATE: "แก้ไข", DELETE: "ลบ", APPROVE: "อนุมัติ", REJECT: "ปฏิเสธ",
  LOGIN: "เข้าสู่ระบบ", LOGOUT: "ออกจากระบบ", VIEW_SENSITIVE: "เปิดดูข้อมูลสำคัญ", EXPORT: "ส่งออกข้อมูล",
  POPULATION_IMPORT_STARTED: "เริ่มนำเข้าข้อมูลประชากร", POPULATION_IMPORT_VALIDATED: "ตรวจสอบไฟล์ข้อมูลประชากร",
  POPULATION_IMPORT_CONFIRMED: "ยืนยันการนำเข้าข้อมูลประชากร", POPULATION_IMPORT_COMPLETED: "นำเข้าข้อมูลประชากรสำเร็จ",
  POPULATION_IMPORT_PARTIAL: "นำเข้าข้อมูลประชากรบางส่วน", POPULATION_IMPORT_FAILED: "นำเข้าข้อมูลประชากรไม่สำเร็จ",
  POPULATION_IMPORT_ROLLBACK: "ย้อนกลับการนำเข้าข้อมูลประชากร", POPULATION_EXPORT_CREATED: "ส่งออกข้อมูลประชากร",
  VILLAGE_CREATED_FROM_CATALOG: "สร้างหมู่บ้านจากฐานข้อมูล", VILLAGE_CREATED_MANUAL: "สร้างหมู่บ้านด้วยตนเอง",
  VILLAGE_CATALOG_IMPORTED: "นำเข้าฐานข้อมูลหมู่บ้าน", VILLAGE_CATALOG_UPDATED: "ปรับปรุงฐานข้อมูลหมู่บ้าน",
  APPROVE_RESIDENT_WITH_NATIONAL_ID: "ยืนยันตัวตนลูกบ้าน", REVOKE_DUPLICATE_NATIONAL_ID_ACCOUNT: "จัดการบัญชีซ้ำ",
  RELEASE_PHONE_FROM_REVOKED_ACCOUNT: "ปลดเบอร์โทรจากบัญชีเดิม",
};

export function auditActionLabel(action: AuditAction) {
  const labels: Partial<Record<AuditAction, string>> = { CREATE: "สร้าง", UPDATE: "แก้ไข", DELETE: "ลบ", APPROVE: "อนุมัติ", REJECT: "ปฏิเสธ", LOGIN: "เข้าสู่ระบบ", LOGOUT: "ออกจากระบบ", EXPORT: "ส่งออก", VIEW_SENSITIVE: "เปิดดูข้อมูลสำคัญ" };
  return labels[action] ?? actionLabels[action] ?? action;
}

function usefulChanges(metadata: Record<string, Prisma.JsonValue>) {
  const before = asObject(metadata.oldValue);
  const after = asObject(metadata.newValue);
  return Object.keys(fieldLabels).flatMap((key) => {
    const previous = displayFieldValue(key, before[key]);
    const next = displayFieldValue(key, after[key]);
    return previous === null && next === null ? [] : [{ label: fieldLabels[key], before: previous, after: next }];
  });
}

/** Converts storage-oriented audit fields into safe, village-user-facing content. */
export function formatAuditEvent(input: AuditInput): FormattedAuditEvent {
  const metadata = asObject(input.metadata);
  const resourceLabel = investigationResourceLabels[input.resource] ?? resourceLabels[input.resource] ?? input.resource;
  const actionName = text(metadata.actionName);
  const targetFromMetadata = [metadata.targetName, metadata.title, metadata.name, metadata.subject, metadata.houseNumber, metadata.fileName]
    .map(text)
    .find((value): value is string => Boolean(value && value.trim()));
  const actorRole = text(metadata.actorRole);
  const actorType = text(metadata.actorType);
  // Current Headman-sensitive actions also store supportReason. It is only a
  // legacy intervention marker when old metadata has no current actor identity.
  const isLegacySupportIntervention = Boolean(text(metadata.supportReason)) && !actorRole && !actorType;
  const isSuperAdminIntervention = actorRole === "SUPERADMIN" || actorType === "SUPERADMIN_ENV" || isLegacySupportIntervention;
  const reason = [metadata.supportReason, metadata.reason]
    .map(text)
    .find((value): value is string => Boolean(value && value.trim())) ?? null;
  return {
    label: actionName === "HOUSE_BATCH_CREATED" && typeof metadata.count === "number" ? `เพิ่มบ้าน ${metadata.count} หลัง` : actionName && actionNameLabels[actionName] ? actionNameLabels[actionName] : fallbackLabel(input.action, resourceLabel),
    ...classify(input.action, input.resource),
    resourceLabel,
    actorRole,
    targetFromMetadata: targetFromMetadata ?? null,
    changes: usefulChanges(metadata),
    reason,
    isSuperAdminIntervention,
  };
}

export function auditCategoryMatches(event: FormattedAuditEvent, filter: string) {
  if (filter === "ALL") return true;
  if (filter === "REVIEW") return event.category === "REVIEW";
  if (filter === "AUTH_SECURITY") return event.category === "AUTH" || event.category === "SECURITY";
  return event.category === filter;
}

export function auditModuleForResource(resource: string) {
  if (["News", "NewsSubmission"].includes(resource)) return "NEWS";
  if (["Person", "House", "BindingRequest", "PopulationImportJob", "PopulationExport"].includes(resource)) return "POPULATION";
  if (["VillagePlace", "VillagePlaceSubmission"].includes(resource)) return "PLACE";
  if (resource.includes("Gallery")) return "GALLERY";
  if (resource === "DownloadFile") return "DOWNLOAD";
  if (resource.includes("VillageEvent")) return "CALENDAR";
  if (resource === "Issue") return "ISSUE";
  if (["Village", "ContactDirectory", "ContactRequest", "TransparencyRecord", "SystemSettings", "VillageBroadcast"].includes(resource)) return "SETTINGS";
  return "OTHER";
}

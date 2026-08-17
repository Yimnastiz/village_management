import Link from "next/link";
import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { ClipboardList } from "lucide-react";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { getAdminMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { auditCategoryMatches, auditModuleForResource, formatAuditEvent } from "@/lib/audit-event";
import { formatNewsAuthor } from "@/lib/news-author";
import { prisma } from "@/lib/prisma";
import { AuditEventList, type AuditListEvent } from "./audit-event-list";
import { AuditCustomDateFilter } from "./audit-custom-date-filter";

const PAGE_SIZE = 25;
const ADMIN_ROLES = [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN, VillageMembershipRole.COMMITTEE];
const MODULE_RESOURCES: Record<string, string[]> = { NEWS: ["News", "NewsSubmission"], POPULATION: ["Person", "House", "BindingRequest", "PopulationImportJob", "PopulationExport"], PLACE: ["VillagePlace", "VillagePlaceSubmission"], GALLERY: ["GalleryAlbum", "GalleryItemSubmission"], DOWNLOAD: ["DownloadFile"], CALENDAR: ["VillageEvent", "VillageEventSubmission"], ISSUE: ["Issue"], SETTINGS: ["Village", "ContactDirectory", "ContactRequest", "TransparencyRecord"] };
const EVENT_ACTIONS: Record<string, Array<"CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "REJECT" | "LOGIN" | "LOGOUT" | "VIEW_SENSITIVE" | "APPROVE_RESIDENT_WITH_NATIONAL_ID" | "REVOKE_DUPLICATE_NATIONAL_ID_ACCOUNT" | "RELEASE_PHONE_FROM_REVOKED_ACCOUNT">> = { CREATE: ["CREATE"], UPDATE: ["UPDATE"], DELETE: ["DELETE"], REVIEW: ["APPROVE", "REJECT"], AUTH_SECURITY: ["LOGIN", "LOGOUT", "VIEW_SENSITIVE", "APPROVE_RESIDENT_WITH_NATIONAL_ID", "REVOKE_DUPLICATE_NATIONAL_ID_ACCOUNT", "RELEASE_PHONE_FROM_REVOKED_ACCOUNT"] };
type PageProps = { searchParams?: Promise<{ q?: string; period?: string; from?: string; to?: string; event?: string; actor?: string; module?: string; page?: string }> };

function dateBounds(period: string, from?: string, to?: string) {
  const now = new Date(); const start = new Date(now);
  if (period === "CUSTOM") { const range: { gte?: Date; lte?: Date } = {}; if (/^\d{4}-\d{2}-\d{2}$/.test(from ?? "")) range.gte = new Date(`${from}T00:00:00`); if (/^\d{4}-\d{2}-\d{2}$/.test(to ?? "")) range.lte = new Date(`${to}T23:59:59.999`); return Object.keys(range).length ? range : undefined; }
  if (period === "TODAY") start.setHours(0, 0, 0, 0);
  if (period === "7D") start.setDate(start.getDate() - 6);
  if (period === "30D") start.setDate(start.getDate() - 29);
  return period === "ALL" ? undefined : { gte: start };
}
function groupDate(value: Date) {
  const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(); const date = new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  if (date === today) return "วันนี้"; if (date === today - 86_400_000) return "เมื่อวาน";
  return value.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}
function shortTime(value: Date) { return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit" }).format(value) + " น."; }
function href(params: Record<string, string | number | undefined>) { const query = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value && value !== "ALL" && value !== "1") query.set(key, String(value)); }); const suffix = query.toString(); return suffix ? `/admin/security?${suffix}` : "/admin/security"; }

async function resolveTargetNames(villageId: string, logs: Array<{ resource: string; resourceId: string | null }>) {
  const ids = (resource: string) => logs.filter((log) => log.resource === resource && log.resourceId).map((log) => log.resourceId!);
  const [news, places, houses, people, galleries, downloads, events, issues, transparency, contacts] = await Promise.all([
    prisma.news.findMany({ where: { villageId, id: { in: ids("News") } }, select: { id: true, title: true } }),
    prisma.villagePlace.findMany({ where: { villageId, id: { in: ids("VillagePlace") } }, select: { id: true, name: true } }),
    prisma.house.findMany({ where: { villageId, id: { in: ids("House") } }, select: { id: true, houseNumber: true } }),
    prisma.person.findMany({ where: { villageId, id: { in: ids("Person") } }, select: { id: true, firstName: true, lastName: true } }),
    prisma.galleryAlbum.findMany({ where: { villageId, id: { in: ids("GalleryAlbum") } }, select: { id: true, title: true } }),
    prisma.downloadFile.findMany({ where: { villageId, id: { in: ids("DownloadFile") } }, select: { id: true, title: true } }),
    prisma.villageEvent.findMany({ where: { villageId, id: { in: ids("VillageEvent") } }, select: { id: true, title: true } }),
    prisma.issue.findMany({ where: { villageId, id: { in: ids("Issue") } }, select: { id: true, title: true } }),
    prisma.transparencyRecord.findMany({ where: { villageId, id: { in: ids("TransparencyRecord") } }, select: { id: true, title: true } }),
    prisma.contactDirectory.findMany({ where: { villageId, id: { in: ids("ContactDirectory") } }, select: { id: true, name: true } }),
  ]);
  return new Map<string, string>([...news.map((row) => [row.id, row.title] as const), ...places.map((row) => [row.id, row.name] as const), ...houses.map((row) => [row.id, `บ้านเลขที่ ${row.houseNumber}`] as const), ...people.map((row) => [row.id, `${row.firstName} ${row.lastName}`.trim()] as const), ...galleries.map((row) => [row.id, row.title] as const), ...downloads.map((row) => [row.id, row.title] as const), ...events.map((row) => [row.id, row.title] as const), ...issues.map((row) => [row.id, row.title] as const), ...transparency.map((row) => [row.id, row.title] as const), ...contacts.map((row) => [row.id, row.name] as const)]);
}

export default async function SecurityPage({ searchParams }: PageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {}; const session = await getSessionContextFromServerCookies(); const membership = session ? getAdminMembership(session) : null;
  if (!membership) return null;
  const q = params.q?.trim() ?? ""; const period = ["ALL", "TODAY", "7D", "30D", "CUSTOM"].includes(params.period ?? "") ? params.period! : "30D"; const from = params.from ?? ""; const to = params.to ?? ""; const eventFilter = ["ALL", "CREATE", "UPDATE", "DELETE", "REVIEW", "AUTH_SECURITY"].includes(params.event ?? "") ? params.event! : "ALL"; const moduleFilter = ["ALL", "NEWS", "POPULATION", "PLACE", "GALLERY", "DOWNLOAD", "CALENDAR", "ISSUE", "SETTINGS"].includes(params.module ?? "") ? params.module! : "ALL"; const actorFilter = params.actor ?? "ALL"; const page = Math.max(1, Number(params.page) || 1); const createdAt = dateBounds(period, from, to);
  const [actors, rawLogs] = await Promise.all([
    prisma.villageMembership.findMany({ where: { villageId: membership.villageId, status: MembershipStatus.ACTIVE, role: { in: ADMIN_ROLES } }, orderBy: { user: { name: "asc" } }, select: { userId: true, role: true, user: { select: { name: true, systemRole: true } } } }),
    prisma.auditLog.findMany({ where: { villageId: membership.villageId, ...(createdAt ? { createdAt } : {}), ...(actorFilter !== "ALL" ? { userId: actorFilter } : {}), ...(moduleFilter !== "ALL" ? { resource: { in: MODULE_RESOURCES[moduleFilter] } } : {}), ...(eventFilter !== "ALL" ? { action: { in: EVENT_ACTIONS[eventFilter] } } : {}) }, orderBy: { createdAt: "desc" }, skip: q ? 0 : (page - 1) * PAGE_SIZE, take: q ? 200 : PAGE_SIZE + 1, select: { id: true, action: true, resource: true, resourceId: true, metadata: true, createdAt: true, user: { select: { name: true, systemRole: true, memberships: { where: { villageId: membership.villageId, status: MembershipStatus.ACTIVE }, select: { role: true }, take: 1 } } } } }),
  ]);
  const names = await resolveTargetNames(membership.villageId, rawLogs);
  const loweredQuery = q.toLocaleLowerCase("th-TH");
  const filtered = rawLogs.flatMap((log) => {
    const event = formatAuditEvent(log); const target = log.resourceId ? names.get(log.resourceId) ?? event.targetFromMetadata : event.targetFromMetadata; const searchable = `${log.user?.name ?? ""} ${event.label} ${event.resourceLabel} ${target ?? ""}`.toLocaleLowerCase("th-TH");
    if (!auditCategoryMatches(event, eventFilter) || (moduleFilter !== "ALL" && auditModuleForResource(log.resource) !== moduleFilter) || (q && !searchable.includes(loweredQuery))) return [];
    const actor = log.user ? formatNewsAuthor(log.user.name, log.user.systemRole, log.user.memberships[0]?.role) : "ผู้ดูแลหมู่บ้านเดิม";
    return [{ id: log.id, actor, event: event.label, item: target, time: log.createdAt.toISOString(), shortTime: shortTime(log.createdAt), dateGroup: groupDate(log.createdAt), icon: event.icon, tone: event.tone, changes: event.changes } satisfies AuditListEvent];
  });
  const visibleEvents = q ? filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : filtered.slice(0, PAGE_SIZE); const hasNext = q ? filtered.length > page * PAGE_SIZE : rawLogs.length > PAGE_SIZE; const activeFilters = period !== "30D" || eventFilter !== "ALL" || moduleFilter !== "ALL" || actorFilter !== "ALL"; const base = { q: q || undefined, period: period === "30D" ? undefined : period, from: period === "CUSTOM" ? from || undefined : undefined, to: period === "CUSTOM" ? to || undefined : undefined, event: eventFilter === "ALL" ? undefined : eventFilter, actor: actorFilter === "ALL" ? undefined : actorFilter, module: moduleFilter === "ALL" ? undefined : moduleFilter };
  const actorOptions = [{ label: "ทุกคน", value: "ALL" }, ...actors.map((actor) => ({ label: formatNewsAuthor(actor.user.name, actor.user.systemRole, actor.role), value: actor.userId }))];
  return <div data-admin-compact-top className="space-y-3"><AdminListToolbar title="บันทึกเหตุการณ์" description="ตรวจสอบการเปลี่ยนแปลงและกิจกรรมสำคัญภายในหมู่บ้าน" searchAction="/admin/security" keyword={q} searchPlaceholder="ค้นหาผู้ดำเนินการ รายการ หรือเหตุการณ์" searchLabel="ค้นหาเหตุการณ์" sticky suggestionTitles={[]} clearHref="/admin/security" groups={[
    { label: "ช่วงเวลา", options: [["วันนี้", "TODAY"], ["7 วัน", "7D"], ["30 วัน", "30D"], ["กำหนดเอง", "CUSTOM"]].map(([label, value]) => ({ label, href: href({ ...base, period: value, from: value === "CUSTOM" ? from || undefined : undefined, to: value === "CUSTOM" ? to || undefined : undefined }), active: period === value, isDefault: value === "30D" })) },
    { label: "ประเภท", options: [["ทั้งหมด", "ALL"], ["เพิ่มข้อมูล", "CREATE"], ["แก้ไข", "UPDATE"], ["ลบ", "DELETE"], ["อนุมัติ/ปฏิเสธ", "REVIEW"], ["เข้าสู่ระบบ/ความปลอดภัย", "AUTH_SECURITY"]].map(([label, value]) => ({ label, href: href({ ...base, event: value }), active: eventFilter === value })) },
    { label: "ผู้ดำเนินการ", options: actorOptions.map((option) => ({ label: option.label, href: href({ ...base, actor: option.value }), active: actorFilter === option.value })) },
    { label: "หมวด", options: [["ทั้งหมด", "ALL"], ["ข่าวสาร", "NEWS"], ["ประชากร", "POPULATION"], ["สถานที่", "PLACE"], ["แกลเลอรี", "GALLERY"], ["เอกสาร", "DOWNLOAD"], ["ปฏิทิน", "CALENDAR"], ["ปัญหา", "ISSUE"], ["การตั้งค่า", "SETTINGS"]].map(([label, value]) => ({ label, href: href({ ...base, module: value }), active: moduleFilter === value })) },
  ]} extraFilters={<AuditCustomDateFilter from={from} to={to} />} />{visibleEvents.length ? <AuditEventList events={visibleEvents} /> : <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center"><ClipboardList aria-hidden="true" className="mx-auto mb-3 h-10 w-10 text-gray-300" /><p className="font-medium text-gray-700">{activeFilters || q ? "ไม่พบเหตุการณ์ที่ตรงกับเงื่อนไข" : "ยังไม่มีบันทึกเหตุการณ์"}</p><p className="mt-1 text-sm text-gray-500">เหตุการณ์สำคัญของหมู่บ้านจะแสดงที่นี่</p></div>}{visibleEvents.length ? <nav className="flex items-center justify-between gap-3" aria-label="แบ่งหน้าบันทึกเหตุการณ์"><span className="text-sm text-gray-500">แสดงล่าสุดก่อน · หน้าละ {PAGE_SIZE} รายการ</span><div className="flex gap-2">{page > 1 ? <Link href={href({ ...base, page: page - 1 })} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">ก่อนหน้า</Link> : null}{hasNext ? <Link href={href({ ...base, page: page + 1 })} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">ถัดไป</Link> : null}</div></nav> : null}</div>;
}

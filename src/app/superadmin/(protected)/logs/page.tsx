import { AuditAction, Prisma } from "@prisma/client";
import { QueryPagination } from "@/components/ui/query-pagination";
import { AdminListToolbar, type ToolbarGroup } from "@/components/ui/admin-list-toolbar";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { auditActionLabel, auditActorRoleLabel, auditModuleLabel, auditResourcesForModule, formatAuditEvent, IMPORTANT_AUDIT_RESOURCES } from "@/lib/audit-event";
import { AuditLogTable, type AuditLogRow } from "./audit-log-table";
import { LogsViewSwitch } from "./logs-view-switch";

const ESSENTIAL_ACTIONS = ["CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT", "EXPORT", "LOGIN", "LOGOUT"] as const;
const moduleOptions = ["VILLAGE", "ACCOUNTS", "MEMBERS", "POPULATION", "HOUSEHOLD", "BINDING", "NEWS", "CALENDAR", "APPOINTMENT", "ISSUE", "GALLERY", "PLACE", "DOWNLOAD", "TRANSPARENCY", "SETTINGS"];
type PageProps = { searchParams?: Promise<{ q?: string; view?: string; action?: string; module?: string; dateFrom?: string; dateTo?: string; page?: string }> };

function validDate(value: string, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
function makeHref(params: Record<string, string | undefined>) { const query = new URLSearchParams(); for (const [key, value] of Object.entries(params)) if (value) query.set(key, value); return `/superadmin/logs${query.size ? `?${query.toString()}` : ""}`; }

export default async function SuperAdminLogsPage({ searchParams }: PageProps) {
  await requireSuperAdminPageSession();
  const params = (searchParams ? await searchParams : {}) ?? {};
  const keyword = (params.q ?? "").trim(); const view = params.view === "important" ? "important" : "all"; const action = (params.action ?? "all").trim();
  const selectedModule = moduleOptions.includes((params.module ?? "").trim()) ? (params.module ?? "").trim() : ""; const dateFrom = (params.dateFrom ?? "").trim(); const dateTo = (params.dateTo ?? "").trim();
  const page = Math.max(1, Number(params.page ?? "1") || 1); const pageSize = 25; const selectedAction = Object.values(AuditAction).includes(action as AuditAction) ? action as AuditAction : null;
  const startDate = validDate(dateFrom); const endDate = validDate(dateTo, true); const resources = selectedModule ? auditResourcesForModule(selectedModule) : []; const resourceFilter = resources.length ? (view === "important" ? resources.filter((item) => IMPORTANT_AUDIT_RESOURCES.includes(item as typeof IMPORTANT_AUDIT_RESOURCES[number])) : resources) : view === "important" ? [...IMPORTANT_AUDIT_RESOURCES] : [];
  const where: Prisma.AuditLogWhereInput = {
    ...(view === "important" ? { action: { in: [...ESSENTIAL_ACTIONS] } } : {}), ...(selectedAction ? { action: selectedAction } : {}), ...(resourceFilter.length ? { resource: { in: [...resourceFilter] } } : {}), ...((startDate || endDate) ? { createdAt: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } } : {}),
    ...(keyword ? { OR: [{ resource: { contains: keyword, mode: "insensitive" as const } }, { resourceId: { contains: keyword, mode: "insensitive" as const } }, { user: { is: { name: { contains: keyword, mode: "insensitive" as const } } } }, { user: { is: { phoneNumber: { contains: keyword, mode: "insensitive" as const } } } }, { village: { is: { name: { contains: keyword, mode: "insensitive" as const } } } }] } : {}),
  };
  const [rawLogs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, createdAt: true, action: true, resource: true, resourceId: true, metadata: true, user: { select: { name: true, phoneNumber: true, systemRole: true } }, village: { select: { name: true, moo: true } } } }),
    prisma.auditLog.count({ where }),
  ]);
  const rows: AuditLogRow[] = rawLogs.map((log) => {
    const metadata = (log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata) ? log.metadata : {}) as Record<string, unknown>;
    const formatted = formatAuditEvent({ action: log.action, resource: log.resource, metadata: log.metadata }); const actorRoleValue = typeof metadata.actorRole === "string" ? metadata.actorRole : log.user?.systemRole ?? null; const actorRole = auditActorRoleLabel(actorRoleValue); const actor = log.user?.name || log.user?.phoneNumber || "ระบบ";
    return { id: log.id, createdAt: log.createdAt.toISOString(), actionLabel: auditActionLabel(log.action), actionTone: formatted.tone, actor, actorRole, resourceLabel: formatted.resourceLabel, target: formatted.targetFromMetadata, villageName: log.village?.name ?? null, villageMoo: log.village?.moo ?? null, referenceId: log.resourceId, detail: { actor, actorRole, event: formatted.label, item: formatted.targetFromMetadata, referenceId: log.resourceId, time: log.createdAt.toISOString(), formattedTime: log.createdAt.toLocaleString("th-TH", { dateStyle: "full", timeStyle: "medium", timeZone: "Asia/Bangkok" }), changes: formatted.changes, reason: formatted.reason, reasonLabel: "เหตุผลประกอบการดำเนินการ", resourceLabel: formatted.resourceLabel, village: log.village ? `${log.village.name}${log.village.moo ? ` · หมู่ ${log.village.moo}` : ""}` : "ส่วนกลาง", isSuperAdminIntervention: formatted.isSuperAdminIntervention } };
  });
  const base = { q: keyword || undefined, view, module: selectedModule || undefined, action: selectedAction ?? undefined, dateFrom: startDate ? dateFrom : undefined, dateTo: endDate ? dateTo : undefined };
  const actionGroup: ToolbarGroup = { label: "การดำเนินการ", options: [{ label: "ทั้งหมด", href: makeHref(base), active: !selectedAction, isDefault: true }, ...Object.values(AuditAction).map((item) => ({ label: auditActionLabel(item), href: makeHref({ ...base, action: item }), active: item === selectedAction }))] };
  const moduleGroup: ToolbarGroup = { label: "ประเภทข้อมูล", options: [{ label: "ทั้งหมด", href: makeHref(base), active: !selectedModule, isDefault: true }, ...moduleOptions.map((item) => ({ label: auditModuleLabel(item), href: makeHref({ ...base, module: item }), active: item === selectedModule }))] };
  return <div className="workspace-list-page -mt-4 mx-auto flex min-h-0 w-full max-w-[1500px] flex-col space-y-4 sm:-mt-6 sm:overflow-visible">
    <AdminListToolbar title="บันทึกกิจกรรม" description="ตรวจสอบการดำเนินการที่สำคัญและประวัติการเปลี่ยนแปลงภายในระบบ" keyword={keyword} searchPlaceholder="ค้นหาผู้กระทำ รายการ หรือหมู่บ้าน" searchAction="/superadmin/logs" groups={[actionGroup, moduleGroup]} clearHref={makeHref({ view })} hideHeading compact sticky actions={<LogsViewSwitch view={view} />} extraFilters={<form method="GET" action="/superadmin/logs" className="flex flex-wrap items-end gap-2 border-l border-slate-200 pl-2"><input type="hidden" name="view" value={view} /><input type="hidden" name="q" value={keyword} /><input type="hidden" name="action" value={selectedAction ?? ""} /><input type="hidden" name="module" value={selectedModule} /><label className="grid gap-1 text-xs text-slate-500"><span>ตั้งแต่วันที่</span><input type="date" name="dateFrom" defaultValue={startDate ? dateFrom : ""} className="h-9 rounded-md border border-gray-300 px-2 text-sm text-slate-700" /></label><label className="grid gap-1 text-xs text-slate-500"><span>ถึงวันที่</span><input type="date" name="dateTo" defaultValue={endDate ? dateTo : ""} className="h-9 rounded-md border border-gray-300 px-2 text-sm text-slate-700" /></label><button type="submit" className="h-9 rounded-md bg-slate-800 px-3 text-sm font-medium text-white hover:bg-slate-700">ใช้ช่วงเวลา</button></form>} />
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">{view === "important" ? "บันทึกสำคัญ" : "กิจกรรมทั้งหมด"}</h2><p className="text-sm text-slate-500">พบ {totalCount.toLocaleString("th-TH")} รายการ</p></div><AuditLogTable rows={rows} /></section>
    {rows.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center"><p className="font-medium text-slate-700">ไม่พบบันทึกกิจกรรมตามเงื่อนไขที่เลือก</p><p className="mt-1 text-sm text-slate-500">ลองปรับคำค้นหาหรือตัวกรองแล้วตรวจสอบอีกครั้ง</p></div> : null}
    <QueryPagination pathname="/superadmin/logs" page={page} totalPages={Math.max(1, Math.ceil(totalCount / pageSize))} params={base} />
  </div>;
}

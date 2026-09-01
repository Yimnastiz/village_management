import Link from "next/link";
import type { ReactNode } from "react";
import { Building2, ClipboardList, Megaphone, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { formatAuditEvent } from "@/lib/audit-event";

const ATTENTION_AUDIT_RESOURCES = [
  "Village", "VillageStatus", "UserSystemRole", "VillageAdminRoleAssignment", "VillageAdminRoleRemoval",
  "UserMembershipSuspension", "UserProfile", "UserMembership", "UserAccount", "GlobalSetting", "SystemWideBroadcast",
] as const;
const OPEN_ISSUE_STAGES = ["OPEN", "IN_PROGRESS", "WAITING"] as const;

type KpiProps = { label: string; value: number; href?: string; tone?: "default" | "attention" };

function KpiCard({ label, value, href, tone = "default" }: KpiProps) {
  const content = <><p className="text-sm font-medium text-gray-500">{label}</p><p className={`mt-1 text-2xl font-semibold tracking-tight ${tone === "attention" ? "text-amber-700" : "text-gray-900"}`}>{value.toLocaleString("th-TH")}</p></>;
  return href ? <Link href={href} aria-label={`${label} ${value.toLocaleString("th-TH")} รายการ`} className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2">{content}</Link> : <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm">{content}</div>;
}

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="rounded-xl border border-gray-200 bg-white shadow-sm"><div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5"><h2 className="text-base font-semibold text-gray-900">{title}</h2>{action}</div><div className="p-4 sm:p-5">{children}</div></section>;
}

export default async function SuperAdminDashboardPage() {
  await requireSuperAdminPageSession();

  const [activeVillageCount, userCount, boundResidentCount, pendingBindingCount, pendingIssueCount, pendingAppointmentCount, activeVillages, recentLogs] = await Promise.all([
    prisma.village.count({ where: { isActive: true } }),
    prisma.user.count(),
    prisma.villageMembership.count({ where: { role: "RESIDENT", status: "ACTIVE", houseId: { not: null } } }),
    prisma.bindingRequest.count({ where: { status: "PENDING" } }),
    prisma.issue.count({ where: { stage: { in: [...OPEN_ISSUE_STAGES] } } }),
    prisma.appointment.count({ where: { stage: { in: ["PENDING_APPROVAL", "TIME_SUGGESTED"] } } }),
    prisma.village.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.auditLog.findMany({
      where: { resource: { in: [...ATTENTION_AUDIT_RESOURCES] } },
      orderBy: { createdAt: "desc" }, take: 8,
      select: { id: true, action: true, resource: true, metadata: true, createdAt: true, user: { select: { name: true } }, village: { select: { name: true } } },
    }),
  ]);

  const [pendingBindingsByVillage, openIssuesByVillage, activeHeadmenByVillage] = await Promise.all([
    prisma.bindingRequest.groupBy({ by: ["villageId"], where: { status: "PENDING" }, _count: { _all: true } }),
    prisma.issue.groupBy({ by: ["villageId"], where: { stage: { in: [...OPEN_ISSUE_STAGES] } }, _count: { _all: true } }),
    prisma.villageMembership.groupBy({ by: ["villageId"], where: { role: "HEADMAN", status: "ACTIVE" }, _count: { _all: true } }),
  ]);

  const pendingByVillage = new Map(pendingBindingsByVillage.map((row) => [row.villageId, row._count._all]));
  const issuesByVillage = new Map(openIssuesByVillage.map((row) => [row.villageId, row._count._all]));
  const headmenByVillage = new Map(activeHeadmenByVillage.map((row) => [row.villageId, row._count._all]));
  const pendingBindingVillageCount = pendingBindingsByVillage.length;
  const openIssueVillageCount = openIssuesByVillage.length;
  const villagesNeedingAttention = activeVillages.map((village) => ({
    ...village,
    pendingBindings: pendingByVillage.get(village.id) ?? 0,
    openIssues: issuesByVillage.get(village.id) ?? 0,
    missingHeadman: (headmenByVillage.get(village.id) ?? 0) === 0,
  })).filter((village) => village.missingHeadman || village.pendingBindings > 0 || village.openIssues > 0)
    .sort((a, b) => Number(b.missingHeadman) - Number(a.missingHeadman) || (b.pendingBindings + b.openIssues) - (a.pendingBindings + a.openIssues)).slice(0, 5);
  const pendingTotal = pendingBindingCount + pendingIssueCount + pendingAppointmentCount;
  const logs = recentLogs.map((log) => {
    const formatted = formatAuditEvent({ action: log.action, resource: log.resource, metadata: log.metadata });
    return { ...log, label: formatted.label, target: formatted.targetFromMetadata ?? formatted.resourceLabel, actor: log.user?.name ?? "ระบบ" };
  });

  return <div className="mx-auto w-full max-w-7xl space-y-4">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <KpiCard label="หมู่บ้านที่เปิดใช้งาน" value={activeVillageCount} href="/superadmin/villages" />
      <KpiCard label="ผู้ใช้งานทั้งหมด" value={userCount} href="/superadmin/users" />
      <KpiCard label="ลูกบ้านที่ผูกบ้านแล้ว" value={boundResidentCount} href="/superadmin/users" />
      <KpiCard label="รายการรอดำเนินการ" value={pendingTotal} href="/superadmin/villages" tone="attention" />
      <KpiCard label="ปัญหาที่ยังไม่เสร็จ" value={pendingIssueCount} href="/superadmin/villages" tone="attention" />
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="ต้องดำเนินการ">
        <div className="divide-y divide-gray-100">
          {[
            ["คำขอผูกบ้านรอตรวจ", pendingBindingCount, `${pendingBindingVillageCount.toLocaleString("th-TH")} หมู่บ้าน`],
            ["ปัญหาที่ยังไม่เสร็จ", pendingIssueCount, `${openIssueVillageCount.toLocaleString("th-TH")} หมู่บ้าน`],
            ["นัดหมายที่ยังต้องดำเนินการ", pendingAppointmentCount, "รายการที่รอการยืนยันหรืออนุมัติ"],
          ].map(([label, count, context]) => <Link key={label} href="/superadmin/villages" className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"><div className="min-w-0"><p className="break-words text-sm font-medium text-gray-800">{label}</p><p className="mt-0.5 text-xs text-gray-500">{context}</p></div><span className="shrink-0 text-lg font-semibold text-gray-900">{Number(count).toLocaleString("th-TH")}</span></Link>)}
        </div>
        {pendingTotal === 0 ? <p className="mt-3 border-t border-gray-100 pt-3 text-sm text-emerald-700">ไม่มีรายการที่ต้องดำเนินการในขณะนี้</p> : null}
      </Panel>

      <Panel title="หมู่บ้านที่ต้องให้ความสนใจ" action={<Link href="/superadmin/villages" className="text-sm font-medium text-cyan-700 hover:text-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600">ดูหมู่บ้านทั้งหมด</Link>}>
        {villagesNeedingAttention.length === 0 ? <p className="text-sm text-emerald-700">ยังไม่พบหมู่บ้านที่ต้องให้ความสนใจ</p> : <div className="divide-y divide-gray-100">{villagesNeedingAttention.map((village) => <div key={village.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-words text-sm font-medium text-gray-800">{village.name}</p><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">{village.missingHeadman ? <span className="text-amber-700">ยังไม่มีผู้ใหญ่บ้าน</span> : null}{village.pendingBindings > 0 ? <span>คำขอผูกบ้าน {village.pendingBindings}</span> : null}{village.openIssues > 0 ? <span>ปัญหาค้าง {village.openIssues}</span> : null}</div></div><Link href={`/superadmin/villages/${village.id}`} className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2">เปิด Workspace</Link></div>)}</div>}
      </Panel>
    </div>

    <Panel title="กิจกรรมสำคัญล่าสุด" action={<Link href="/superadmin/logs?view=important" className="text-sm font-medium text-cyan-700 hover:text-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600">ดู Audit Log ทั้งหมด</Link>}>
      {logs.length === 0 ? <p className="text-sm text-gray-500">ยังไม่มีกิจกรรมสำคัญล่าสุด</p> : <div className="divide-y divide-gray-100">{logs.map((log) => <div key={log.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"><p className="min-w-0 break-words text-sm text-gray-800"><span className="font-medium">{log.actor}</span><span className="mx-1.5 text-gray-400" aria-hidden="true">→</span>{log.label}<span className="mx-1.5 text-gray-400" aria-hidden="true">→</span><span className="font-medium">{log.target}</span>{log.village?.name ? <span className="text-gray-500"> · {log.village.name}</span> : null}</p><time className="shrink-0 text-xs text-gray-500" dateTime={log.createdAt.toISOString()}>{log.createdAt.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</time></div>)}</div>}
    </Panel>

    <Panel title="ทางลัด">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[["/superadmin/villages", "จัดการหมู่บ้าน", Building2], ["/superadmin/users", "ค้นหาผู้ใช้งาน", Users], ["/superadmin/broadcasts", "ประกาศระบบ", Megaphone], ["/superadmin/logs?view=important", "Audit Log", ClipboardList]].map(([href, label, Icon]) => <Link key={String(href)} href={String(href)} className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:border-cyan-200 hover:bg-cyan-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"><Icon className="h-4 w-4 shrink-0 text-cyan-700" aria-hidden="true" /><span>{String(label)}</span></Link>)}
      </div>
    </Panel>
  </div>;
}

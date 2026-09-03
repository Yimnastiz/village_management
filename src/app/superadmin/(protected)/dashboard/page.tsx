import Link from "next/link";
import type { ReactNode } from "react";
import { Building2, ClipboardList, Megaphone, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { formatAuditEvent, IMPORTANT_AUDIT_RESOURCES } from "@/lib/audit-event";

const OPEN_ISSUE_STAGES = ["OPEN", "IN_PROGRESS", "WAITING"] as const;
const PENDING_APPOINTMENT_STAGES = ["PENDING_APPROVAL", "TIME_SUGGESTED"] as const;
const ATTENTION_LIMIT = 12;

type KpiProps = { label: string; value: number; href?: string };
type WorkloadRow = { label: string; count: number; context: string; href: string; action: string };
type AttentionVillage = { id: string; name: string; pendingBindings: number; openIssues: number; pendingAppointments: number; missingHeadman: boolean };

function KpiCard({ label, value, href }: KpiProps) {
  const content = (
    <>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">
        {value.toLocaleString("th-TH")}
      </p>
    </>
  );

  return href ? (
    <Link
      href={href}
      aria-label={`${label} ${value.toLocaleString("th-TH")} รายการ`}
      className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2"
    >
      {content}
    </Link>
  ) : (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm">
      {content}
    </div>
  );
}

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

const villagesHref = (attention: string) => `/superadmin/villages?searched=1&attention=${attention}&status=active`;

function WorkloadList({ rows }: { rows: WorkloadRow[] }) {
  return (
    <div className="divide-y divide-gray-100">
      {rows.map((row) => (
        <Link
          key={row.label}
          href={row.href}
          className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
        >
          <div className="min-w-0">
            <p className="break-words text-sm font-medium text-gray-800">{row.label}</p>
            <p className="mt-0.5 text-xs text-gray-500">{row.context} · {row.action}</p>
          </div>
          <span className="shrink-0 text-lg font-semibold text-gray-900">
            {row.count.toLocaleString("th-TH")}
          </span>
        </Link>
      ))}
    </div>
  );
}

function AttentionVillageList({ villages }: { villages: AttentionVillage[] }) {
  return (
    <div className="divide-y divide-gray-100">
      {villages.map((village) => (
        <div
          key={village.id}
          className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="break-words text-sm font-medium text-gray-800">{village.name}</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
              {village.missingHeadman ? <span className="text-amber-700">ไม่มีผู้ใหญ่บ้าน</span> : null}
              {village.pendingBindings > 0 ? <span>คำขอผูกบ้าน {village.pendingBindings}</span> : null}
              {village.openIssues > 0 ? <span>ปัญหาค้าง {village.openIssues}</span> : null}
              {village.pendingAppointments > 0 ? <span>นัดหมายรอ {village.pendingAppointments}</span> : null}
            </div>
          </div>
          <Link
            href={`/superadmin/villages/${village.id}`}
            className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2"
          >
            เปิด Workspace
          </Link>
        </div>
      ))}
    </div>
  );
}

function ActivityList({ logs }: { logs: Array<{ id: string; actor: string; label: string; target: string; createdAt: Date; village: { name: string } | null }> }) {
  return (
    <div className="divide-y divide-gray-100">
      {logs.map((log) => (
        <div key={log.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <p className="min-w-0 break-words text-sm text-gray-800">
            <span className="font-medium">{log.actor}</span>
            <span className="mx-1.5 text-gray-400" aria-hidden="true">→</span>
            {log.label}
            <span className="mx-1.5 text-gray-400" aria-hidden="true">→</span>
            <span className="font-medium">{log.target}</span>
            {log.village?.name ? <span className="text-gray-500"> · {log.village.name}</span> : null}
          </p>
          <time className="shrink-0 text-xs text-gray-500" dateTime={log.createdAt.toISOString()}>
            {log.createdAt.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
          </time>
        </div>
      ))}
    </div>
  );
}

export default async function SuperAdminDashboardPage() {
  await requireSuperAdminPageSession();

  const [
    activeVillageCount,
    userCount,
    boundMembershipCount,
    missingHeadmanCount,
    pendingBindingCount,
    pendingIssueCount,
    pendingAppointmentCount,
    pendingBindingVillageCount,
    openIssueVillageCount,
    pendingAppointmentVillageCount,
    missingHeadmanCandidates,
    topPendingBindings,
    topOpenIssues,
    topPendingAppointments,
    recentLogs,
  ] = await Promise.all([
    prisma.village.count({ where: { isActive: true } }),
    prisma.user.count(),
    prisma.villageMembership.count({ where: { role: "RESIDENT", status: "ACTIVE", houseId: { not: null } } }),
    prisma.village.count({ where: { isActive: true, memberships: { none: { role: "HEADMAN", status: "ACTIVE" } } } }),
    prisma.bindingRequest.count({ where: { status: "PENDING" } }),
    prisma.issue.count({ where: { stage: { in: [...OPEN_ISSUE_STAGES] } } }),
    prisma.appointment.count({ where: { stage: { in: [...PENDING_APPOINTMENT_STAGES] } } }),
    prisma.village.count({ where: { bindingRequests: { some: { status: "PENDING" } } } }),
    prisma.village.count({ where: { issues: { some: { stage: { in: [...OPEN_ISSUE_STAGES] } } } } }),
    prisma.village.count({ where: { appointments: { some: { stage: { in: [...PENDING_APPOINTMENT_STAGES] } } } } }),
    prisma.village.findMany({
      where: { isActive: true, memberships: { none: { role: "HEADMAN", status: "ACTIVE" } } },
      orderBy: { name: "asc" }, take: ATTENTION_LIMIT, select: { id: true },
    }),
    prisma.bindingRequest.groupBy({
      by: ["villageId"], where: { status: "PENDING", village: { isActive: true } },
      orderBy: { _count: { villageId: "desc" } }, take: ATTENTION_LIMIT, _count: { _all: true },
    }),
    prisma.issue.groupBy({
      by: ["villageId"], where: { stage: { in: [...OPEN_ISSUE_STAGES] }, village: { isActive: true } },
      orderBy: { _count: { villageId: "desc" } }, take: ATTENTION_LIMIT, _count: { _all: true },
    }),
    prisma.appointment.groupBy({
      by: ["villageId"], where: { stage: { in: [...PENDING_APPOINTMENT_STAGES] }, village: { isActive: true } },
      orderBy: { _count: { villageId: "desc" } }, take: ATTENTION_LIMIT, _count: { _all: true },
    }),
    prisma.auditLog.findMany({
      where: { resource: { in: [...IMPORTANT_AUDIT_RESOURCES] } }, orderBy: { createdAt: "desc" }, take: 8,
      select: { id: true, action: true, resource: true, metadata: true, createdAt: true, user: { select: { name: true } }, village: { select: { name: true } } },
    }),
  ]);

  const candidateIds = [...new Set([
    ...missingHeadmanCandidates.map((row) => row.id),
    ...topPendingBindings.map((row) => row.villageId),
    ...topOpenIssues.map((row) => row.villageId),
    ...topPendingAppointments.map((row) => row.villageId),
  ])].filter((id): id is string => Boolean(id));
  const [candidateVillages, pendingBindingsByVillage, openIssuesByVillage, pendingAppointmentsByVillage, activeHeadmenByVillage] = candidateIds.length === 0
    ? [[], [], [], [], []]
    : await Promise.all([
      prisma.village.findMany({ where: { id: { in: candidateIds }, isActive: true }, select: { id: true, name: true } }),
      prisma.bindingRequest.groupBy({ by: ["villageId"], where: { villageId: { in: candidateIds }, status: "PENDING" }, _count: { _all: true } }),
      prisma.issue.groupBy({ by: ["villageId"], where: { villageId: { in: candidateIds }, stage: { in: [...OPEN_ISSUE_STAGES] } }, _count: { _all: true } }),
      prisma.appointment.groupBy({ by: ["villageId"], where: { villageId: { in: candidateIds }, stage: { in: [...PENDING_APPOINTMENT_STAGES] } }, _count: { _all: true } }),
      prisma.villageMembership.groupBy({ by: ["villageId"], where: { villageId: { in: candidateIds }, role: "HEADMAN", status: "ACTIVE" }, _count: { _all: true } }),
    ]);

  const pendingByVillage = new Map(pendingBindingsByVillage.map((row) => [row.villageId, row._count._all]));
  const issuesByVillage = new Map(openIssuesByVillage.map((row) => [row.villageId, row._count._all]));
  const appointmentsByVillage = new Map(pendingAppointmentsByVillage.map((row) => [row.villageId, row._count._all]));
  const headmenByVillage = new Map(activeHeadmenByVillage.map((row) => [row.villageId, row._count._all]));
  const villagesNeedingAttention: AttentionVillage[] = candidateVillages
    .map((village) => ({
      ...village,
      pendingBindings: pendingByVillage.get(village.id) ?? 0,
      openIssues: issuesByVillage.get(village.id) ?? 0,
      pendingAppointments: appointmentsByVillage.get(village.id) ?? 0,
      missingHeadman: (headmenByVillage.get(village.id) ?? 0) === 0,
    }))
    .filter((village) => village.missingHeadman || village.pendingBindings > 0 || village.openIssues > 0 || village.pendingAppointments > 0)
    .sort((a, b) => Number(b.missingHeadman) - Number(a.missingHeadman) || b.pendingBindings - a.pendingBindings || b.openIssues - a.openIssues || b.pendingAppointments - a.pendingAppointments || a.name.localeCompare(b.name, "th"))
    .slice(0, 5);
  const workloadTotal = pendingBindingCount + pendingIssueCount + pendingAppointmentCount;
  const workloadRows: WorkloadRow[] = [
    { label: "คำขอผูกบ้านรอตรวจ", count: pendingBindingCount, context: `${pendingBindingVillageCount.toLocaleString("th-TH")} หมู่บ้าน`, href: villagesHref("pending-bindings"), action: "ดูหมู่บ้านที่มีคำขอ" },
    { label: "ปัญหาที่ยังไม่เสร็จ", count: pendingIssueCount, context: `${openIssueVillageCount.toLocaleString("th-TH")} หมู่บ้าน`, href: villagesHref("open-issues"), action: "ดูหมู่บ้านที่มีปัญหา" },
    { label: "นัดหมายที่ยังต้องดำเนินการ", count: pendingAppointmentCount, context: `${pendingAppointmentVillageCount.toLocaleString("th-TH")} หมู่บ้าน`, href: villagesHref("pending-appointments"), action: "ดูหมู่บ้านที่ต้องดำเนินการ" },
  ];
  const logs = recentLogs.map((log) => {
    const formatted = formatAuditEvent({ action: log.action, resource: log.resource, metadata: log.metadata });
    return { ...log, label: formatted.label, target: formatted.targetFromMetadata ?? formatted.resourceLabel, actor: log.user?.name ?? "ระบบ" };
  });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="หมู่บ้านที่เปิดใช้งาน" value={activeVillageCount} href="/superadmin/villages?searched=1&status=active" />
        <KpiCard label="ผู้ใช้งานทั้งหมด" value={userCount} href="/superadmin/users" />
        <KpiCard label="สมาชิกที่ผูกบ้านแล้ว" value={boundMembershipCount} href="/superadmin/users" />
        <KpiCard label="หมู่บ้านที่ยังไม่มีผู้ใหญ่บ้าน" value={missingHeadmanCount} href={villagesHref("missing-headman")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="ต้องดำเนินการ">
          {workloadTotal === 0 ? <p className="text-sm text-emerald-700">ไม่มีรายการที่ต้องดำเนินการในขณะนี้</p> : <WorkloadList rows={workloadRows} />}
        </Panel>
        <Panel title="หมู่บ้านที่ต้องให้ความสนใจ" action={<Link href="/superadmin/villages?searched=1&status=active" className="text-sm font-medium text-cyan-700 hover:text-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600">ดูหมู่บ้านทั้งหมด</Link>}>
          {villagesNeedingAttention.length === 0 ? <p className="text-sm text-emerald-700">ยังไม่พบหมู่บ้านที่ต้องให้ความสนใจ</p> : <AttentionVillageList villages={villagesNeedingAttention} />}
        </Panel>
      </div>

      <Panel title="กิจกรรมการดูแลระบบล่าสุด" action={<Link href="/superadmin/logs?view=important" className="text-sm font-medium text-cyan-700 hover:text-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600">ดู Audit Log ทั้งหมด</Link>}>
        {logs.length === 0 ? <p className="text-sm text-gray-500">ยังไม่มีกิจกรรมสำคัญล่าสุด</p> : <ActivityList logs={logs} />}
      </Panel>

      <Panel title="ทางลัด">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[["/superadmin/villages", "จัดการหมู่บ้าน", Building2], ["/superadmin/users", "ค้นหาผู้ใช้งาน", Users], ["/superadmin/broadcasts", "ประกาศระบบ", Megaphone], ["/superadmin/logs?view=important", "Audit Log", ClipboardList]].map(([href, label, Icon]) => (
            <Link key={String(href)} href={String(href)} className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:border-cyan-200 hover:bg-cyan-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600">
              <Icon className="h-4 w-4 shrink-0 text-cyan-700" aria-hidden="true" />
              <span>{String(label)}</span>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}

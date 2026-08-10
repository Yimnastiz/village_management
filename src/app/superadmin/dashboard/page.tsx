import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default async function SuperAdminDashboardPage() {
  await requireSuperAdminPageSession();

  const [
    villageCount,
    activeVillageCount,
    userCount,
    superAdminCount,
    activeMembershipCount,
    pendingBindingCount,
    pendingIssuesCount,
    latestLogs,
  ] = await Promise.all([
    prisma.village.count(),
    prisma.village.count({ where: { isActive: true } }),
    prisma.user.count(),
    prisma.user.count({ where: { systemRole: "SUPERADMIN" } }),
    prisma.villageMembership.count({ where: { status: "ACTIVE" } }),
    prisma.bindingRequest.count({ where: { status: "PENDING" } }),
    prisma.issue.count({ where: { stage: { in: ["OPEN", "IN_PROGRESS", "WAITING"] } } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        user: { select: { name: true, phoneNumber: true } },
        village: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">System-wide Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">ภาพรวมทุกหมู่บ้าน ผู้ใช้ และเหตุการณ์สำคัญของระบบ</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="หมู่บ้านทั้งหมด" value={villageCount} hint={`เปิดใช้งาน ${activeVillageCount} หมู่บ้าน`} />
        <StatCard label="ผู้ใช้ทั้งหมด" value={userCount} hint={`Super Admin ${superAdminCount} บัญชี`} />
        <StatCard label="สมาชิกที่ใช้งานอยู่" value={activeMembershipCount} hint="ครอบคลุมทุกหมู่บ้าน" />
        <StatCard label="คำขอผูกบ้านรออนุมัติ" value={pendingBindingCount} />
        <StatCard label="ปัญหาที่ยังไม่ปิด" value={pendingIssuesCount} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">งานด่วนของ Super Admin</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link href="/superadmin/villages" className="group flex min-h-12 items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2">
              <span>จัดการหมู่บ้าน</span><span aria-hidden="true" className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-cyan-700">→</span>
            </Link>
            <Link href="/superadmin/users" className="group flex min-h-12 items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2">
              <span>จัดการผู้ใช้และบทบาท</span><span aria-hidden="true" className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-cyan-700">→</span>
            </Link>
            <Link href="/superadmin/broadcasts" className="group flex min-h-12 items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2">
              <span>ส่งประกาศทุกหมู่บ้าน</span><span aria-hidden="true" className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-cyan-700">→</span>
            </Link>
            <Link href="/superadmin/settings" className="group flex min-h-12 items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2">
              <span>ตั้งค่ากลางระบบ</span><span aria-hidden="true" className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-cyan-700">→</span>
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">กิจกรรมล่าสุดของระบบ</h2>
            <Link href="/superadmin/activities" className="text-sm font-medium text-cyan-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2">
              ดูทั้งหมด
            </Link>
          </div>
          {latestLogs.length === 0 ? (
            <p className="text-sm text-slate-500">ยังไม่มีบันทึกกิจกรรม</p>
          ) : (
            <div className="space-y-2">
              {latestLogs.map((log) => (
                <div key={log.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-medium text-slate-800">{log.action} • {log.resource}</p>
                  <p className="text-xs text-slate-500">
                    โดย {log.user?.name ?? log.user?.phoneNumber ?? "ระบบ"}
                    {log.village?.name ? ` • ${log.village.name}` : ""}
                    {` • ${log.createdAt.toLocaleString("th-TH")}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

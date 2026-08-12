import Link from "next/link";
import { Building2, Megaphone, Settings, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value.toLocaleString()}</p>
      {hint ? <p className="mt-1 truncate text-xs text-slate-500">{hint}</p> : null}
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
    <div className="space-y-5">
      <div className="border-b border-slate-200 pb-4">
        <p className="text-sm font-medium text-cyan-700">Super Admin</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">ภาพรวมระบบ</h1>
        <p className="mt-1 text-sm text-slate-600">ติดตามสถานะหมู่บ้าน ผู้ใช้ และงานที่ต้องดำเนินการจากศูนย์กลาง</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="หมู่บ้านทั้งหมด" value={villageCount} hint={`เปิดใช้งาน ${activeVillageCount} หมู่บ้าน`} />
        <StatCard label="ผู้ใช้ทั้งหมด" value={userCount} hint={`Super Admin ${superAdminCount} บัญชี`} />
        <StatCard label="สมาชิกที่ใช้งานอยู่" value={activeMembershipCount} hint="ครอบคลุมทุกหมู่บ้าน" />
        <StatCard label="คำขอผูกบ้านรออนุมัติ" value={pendingBindingCount} />
        <StatCard label="ปัญหาที่ยังไม่ปิด" value={pendingIssuesCount} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">งานด่วนของ Super Admin</h2>
            <p className="mt-1 text-sm text-slate-500">ทางลัดสำหรับจัดการส่วนสำคัญของระบบ</p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link href="/superadmin/villages" className="group flex min-h-24 items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2">
              <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" aria-hidden="true" />
              <span><span className="block text-sm font-semibold text-slate-800">จัดการหมู่บ้าน</span><span className="mt-1 block text-xs leading-5 text-slate-500">เพิ่ม แก้ไข และเปิด/ปิดการใช้งานหมู่บ้าน</span></span>
            </Link>
            <Link href="/superadmin/users" className="group flex min-h-24 items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2">
              <Users className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" aria-hidden="true" />
              <span><span className="block text-sm font-semibold text-slate-800">จัดการผู้ใช้และบทบาท</span><span className="mt-1 block text-xs leading-5 text-slate-500">ดูผู้ใช้และกำหนดสิทธิ์ระดับระบบ</span></span>
            </Link>
            <Link href="/superadmin/broadcasts" className="group flex min-h-24 items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2">
              <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" aria-hidden="true" />
              <span><span className="block text-sm font-semibold text-slate-800">ส่งประกาศทุกหมู่บ้าน</span><span className="mt-1 block text-xs leading-5 text-slate-500">กระจายข่าวสารถึงทุกหมู่บ้าน</span></span>
            </Link>
            <Link href="/superadmin/settings" className="group flex min-h-24 items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2">
              <Settings className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" aria-hidden="true" />
              <span><span className="block text-sm font-semibold text-slate-800">ตั้งค่ากลางระบบ</span><span className="mt-1 block text-xs leading-5 text-slate-500">จัดการค่าพื้นฐานของแพลตฟอร์ม</span></span>
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="text-lg font-semibold text-slate-900">กิจกรรมล่าสุดของระบบ</h2><p className="mt-1 text-sm text-slate-500">8 รายการล่าสุดจากทั้งระบบ</p></div>
            <Link href="/superadmin/logs?view=all" className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-cyan-700 transition hover:bg-cyan-50 hover:text-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2">
              ดูทั้งหมด
            </Link>
          </div>
          {latestLogs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">ยังไม่มีบันทึกกิจกรรมของระบบ</div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {latestLogs.map((log) => (
                <div key={log.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-sm font-medium text-slate-800">{log.action} <span className="font-normal text-slate-400">•</span> {log.resource}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {log.user?.name ?? log.user?.phoneNumber ?? "ระบบ"}{log.village?.name ? ` · ${log.village.name}` : ""}{` · ${log.createdAt.toLocaleString("th-TH")}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

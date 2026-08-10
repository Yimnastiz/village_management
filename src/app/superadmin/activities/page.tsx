import Link from "next/link";
import { QueryPagination } from "@/components/ui/query-pagination";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

type PageProps = {
  searchParams?: Promise<{ page?: string }>;
};

export default async function SuperAdminActivitiesPage({ searchParams }: PageProps) {
  await requireSuperAdminPageSession();

  const params = (searchParams ? await searchParams : {}) ?? {};
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = 25;
  const [activities, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { name: true, phoneNumber: true } },
        village: { select: { name: true } },
      },
    }),
    prisma.auditLog.count(),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/superadmin/dashboard" className="inline-flex rounded-md text-sm font-medium text-cyan-700 transition hover:text-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2">
          ← กลับ Dashboard
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">กิจกรรมทั้งหมดของระบบ</h1>
        <p className="mt-1 text-sm text-slate-600">รายการกิจกรรมล่าสุดทั้งหมดที่แสดงต่อเนื่องจากหน้า Dashboard</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[760px] w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-slate-600">
              <th className="px-3 py-3">เวลา</th><th className="px-3 py-3">ผู้กระทำ</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">Resource</th><th className="px-3 py-3">หมู่บ้าน</th><th className="px-3 py-3">Resource ID</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((activity) => (
              <tr key={activity.id} className="border-b last:border-0">
                <td className="whitespace-nowrap px-3 py-3 text-slate-700">{activity.createdAt.toLocaleString("th-TH")}</td>
                <td className="px-3 py-3 text-slate-700">{activity.user?.name ?? activity.user?.phoneNumber ?? "system"}</td>
                <td className="px-3 py-3 font-medium text-slate-900">{activity.action}</td>
                <td className="px-3 py-3 text-slate-700">{activity.resource}</td>
                <td className="px-3 py-3 text-slate-700">{activity.village?.name ?? "-"}</td>
                <td className="px-3 py-3 text-slate-500">{activity.resourceId ?? "-"}</td>
              </tr>
            ))}
            {activities.length === 0 ? <tr><td colSpan={6} className="px-3 py-12 text-center text-slate-500">ยังไม่มีบันทึกกิจกรรมของระบบ</td></tr> : null}
          </tbody>
        </table>
      </div>

      <QueryPagination pathname="/superadmin/activities" page={page} totalPages={totalPages} params={{}} />
    </div>
  );
}

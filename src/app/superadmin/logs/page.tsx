import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

export default async function SuperAdminLogsPage() {
  await requireSuperAdminPageSession();

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: {
        select: {
          name: true,
          phoneNumber: true,
        },
      },
      village: {
        select: {
          name: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">บันทึกกิจกรรมระบบ</h1>
        <p className="mt-1 text-sm text-slate-600">ตรวจสอบการกระทำสำคัญระดับระบบและระดับหมู่บ้าน</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-slate-600">
              <th className="px-3 py-2">เวลา</th>
              <th className="px-3 py-2">ผู้กระทำ</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Resource</th>
              <th className="px-3 py-2">หมู่บ้าน</th>
              <th className="px-3 py-2">Resource ID</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b last:border-0">
                <td className="px-3 py-2 text-slate-700">{log.createdAt.toLocaleString("th-TH")}</td>
                <td className="px-3 py-2 text-slate-700">{log.user?.name ?? log.user?.phoneNumber ?? "system"}</td>
                <td className="px-3 py-2 font-medium text-slate-900">{log.action}</td>
                <td className="px-3 py-2 text-slate-700">{log.resource}</td>
                <td className="px-3 py-2 text-slate-700">{log.village?.name ?? "-"}</td>
                <td className="px-3 py-2 text-slate-500">{log.resourceId ?? "-"}</td>
              </tr>
            ))}
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">ยังไม่มีบันทึกกิจกรรม</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

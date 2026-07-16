import { AuditAction, Prisma } from "@prisma/client";
import Link from "next/link";
import { QueryPagination } from "@/components/ui/query-pagination";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

const ESSENTIAL_ACTIONS = ["CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT", "EXPORT", "LOGIN", "LOGOUT"] as const;
const ESSENTIAL_RESOURCES = [
  "Village",
  "VillageStatus",
  "UserSystemRole",
  "VillageAdminRoleAssignment",
  "VillageAdminRoleRemoval",
  "UserMembershipSuspension",
  "UserProfile",
  "UserMembership",
  "UserAccount",
  "GlobalSetting",
  "SystemWideBroadcast",
] as const;

type PageProps = {
  searchParams?: Promise<{ q?: string; action?: string; page?: string }>;
};

export default async function SuperAdminLogsPage({ searchParams }: PageProps) {
  await requireSuperAdminPageSession();
  const params = (searchParams ? await searchParams : {}) ?? {};
  const keyword = (params.q ?? "").trim();
  const action = (params.action ?? "all").trim();
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = 25;

  const selectedAction = Object.values(AuditAction).includes(action as AuditAction)
    ? (action as AuditAction)
    : null;
  const where: Prisma.AuditLogWhereInput = {
    action: selectedAction ?? { in: [...ESSENTIAL_ACTIONS] },
    resource: { in: [...ESSENTIAL_RESOURCES] },
    ...(keyword
      ? {
          OR: [
            { resource: { contains: keyword, mode: "insensitive" as const } },
            { resourceId: { contains: keyword, mode: "insensitive" as const } },
            { user: { is: { name: { contains: keyword, mode: "insensitive" as const } } } },
            { user: { is: { phoneNumber: { contains: keyword, mode: "insensitive" as const } } } },
            { village: { is: { name: { contains: keyword, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };

  const [logs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        createdAt: true,
        action: true,
        resource: true,
        resourceId: true,
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
    }),
    prisma.auditLog.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">บันทึกกิจกรรมระบบ</h1>
        <p className="mt-1 text-sm text-slate-600">ตรวจสอบการกระทำสำคัญระดับระบบและระดับหมู่บ้าน</p>
      </div>

      <form method="GET" className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <input name="q" defaultValue={keyword} placeholder="ค้นหา resource, resource id, ผู้กระทำ, หมู่บ้าน" className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-3" />
        <select name="action" defaultValue={action} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="all">ทุก Action สำคัญ</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
          <option value="APPROVE">APPROVE</option>
          <option value="REJECT">REJECT</option>
          <option value="EXPORT">EXPORT</option>
          <option value="LOGIN">LOGIN</option>
          <option value="LOGOUT">LOGOUT</option>
        </select>
        <div className="md:col-span-4 flex flex-wrap gap-2">
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">ค้นหา</button>
          <Link href="/superadmin/logs" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">ล้างตัวกรอง</Link>
        </div>
      </form>

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

      <QueryPagination pathname="/superadmin/logs" page={page} totalPages={totalPages} params={{ q: keyword || undefined, action: action !== "all" ? action : undefined }} />
    </div>
  );
}

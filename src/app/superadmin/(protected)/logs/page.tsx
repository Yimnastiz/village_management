import { AuditAction, Prisma } from "@prisma/client";
import Link from "next/link";
import { QueryPagination } from "@/components/ui/query-pagination";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { IMPORTANT_AUDIT_RESOURCES } from "@/lib/audit-event";

const ESSENTIAL_ACTIONS = ["CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT", "EXPORT", "LOGIN", "LOGOUT"] as const;

type PageProps = {
  searchParams?: Promise<{ q?: string; view?: string; action?: string; resource?: string; dateFrom?: string; dateTo?: string; page?: string }>;
};

function validDate(value: string, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function makeHref(view: "all" | "important", params: Record<string, string | undefined>) {
  const query = new URLSearchParams({ view });
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  return `/superadmin/logs?${query.toString()}`;
}

export default async function SuperAdminLogsPage({ searchParams }: PageProps) {
  await requireSuperAdminPageSession();
  const params = (searchParams ? await searchParams : {}) ?? {};
  const keyword = (params.q ?? "").trim();
  const view = params.view === "important" ? "important" : "all";
  const action = (params.action ?? "all").trim();
  const resource = (params.resource ?? "").trim();
  const dateFrom = (params.dateFrom ?? "").trim();
  const dateTo = (params.dateTo ?? "").trim();
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = 25;
  const selectedAction = Object.values(AuditAction).includes(action as AuditAction) ? action as AuditAction : null;
  const startDate = validDate(dateFrom);
  const endDate = validDate(dateTo, true);
  const createdAt = startDate || endDate ? { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } : undefined;

  const where: Prisma.AuditLogWhereInput = {
    ...(view === "important" ? { action: { in: [...ESSENTIAL_ACTIONS] }, resource: { in: [...IMPORTANT_AUDIT_RESOURCES] } } : {}),
    ...(selectedAction ? { action: selectedAction } : {}),
    ...(resource ? { resource: { contains: resource, mode: "insensitive" as const } } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(keyword ? {
      OR: [
        { resource: { contains: keyword, mode: "insensitive" as const } },
        { resourceId: { contains: keyword, mode: "insensitive" as const } },
        { user: { is: { name: { contains: keyword, mode: "insensitive" as const } } } },
        { user: { is: { phoneNumber: { contains: keyword, mode: "insensitive" as const } } } },
        { village: { is: { name: { contains: keyword, mode: "insensitive" as const } } } },
      ],
    } : {}),
  };

  const [rawLogs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
      select: { id: true, createdAt: true, action: true, resource: true, resourceId: true, metadata: true, user: { select: { name: true, phoneNumber: true } }, village: { select: { name: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  const logs = rawLogs.map((log) => ({
    ...log,
    user: log.user ?? ((log.metadata as { actorType?: string } | null)?.actorType === "SUPERADMIN_ENV" ? { name: "Super Admin", phoneNumber: "" } : null),
  }));
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const filterParams = { q: keyword || undefined, action: selectedAction ?? undefined, resource: resource || undefined, dateFrom: startDate ? dateFrom : undefined, dateTo: endDate ? dateTo : undefined };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="inline-flex w-full rounded-lg bg-slate-100 p-1 sm:w-auto" role="tablist" aria-label="มุมมองบันทึกกิจกรรม">
          <Link href={makeHref("all", filterParams)} role="tab" aria-selected={view === "all"} className={`flex-1 rounded-md px-3 py-2 text-center text-sm font-medium transition sm:flex-none ${view === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>กิจกรรมทั้งหมด</Link>
          <Link href={makeHref("important", filterParams)} role="tab" aria-selected={view === "important"} className={`flex-1 rounded-md px-3 py-2 text-center text-sm font-medium transition sm:flex-none ${view === "important" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>บันทึกสำคัญ</Link>
        </div>

        <form method="GET" className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input type="hidden" name="view" value={view} />
          <label className="grid gap-1.5 xl:col-span-2"><span className="text-xs font-medium text-slate-600">ค้นหา</span><input name="q" defaultValue={keyword} placeholder="Resource, ID, ผู้กระทำ หรือหมู่บ้าน" className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" /></label>
          <label className="grid gap-1.5"><span className="text-xs font-medium text-slate-600">Action</span><select name="action" defaultValue={selectedAction ?? "all"} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"><option value="all">ทุก Action</option>{Object.values(AuditAction).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="grid gap-1.5"><span className="text-xs font-medium text-slate-600">Resource</span><input name="resource" defaultValue={resource} placeholder="เช่น Village, User" className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" /></label>
          <label className="grid gap-1.5"><span className="text-xs font-medium text-slate-600">ตั้งแต่วันที่</span><input type="date" name="dateFrom" defaultValue={startDate ? dateFrom : ""} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" /></label>
          <label className="grid gap-1.5"><span className="text-xs font-medium text-slate-600">ถึงวันที่</span><input type="date" name="dateTo" defaultValue={endDate ? dateTo : ""} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" /></label>
          <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-2">
            <button type="submit" className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2">ค้นหา</button>
            <Link href={`/superadmin/logs?view=${view}`} className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2">ล้างตัวกรอง</Link>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5"><h2 className="text-sm font-semibold text-slate-900">{view === "all" ? "กิจกรรมทั้งหมด" : "บันทึกสำคัญ"}</h2><p className="text-sm text-slate-500">{totalCount.toLocaleString()} รายการ</p></div>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead><tr className="border-b bg-slate-50 text-left text-xs font-medium text-slate-600"><th className="px-4 py-3">เวลา</th><th className="px-4 py-3">ผู้กระทำ</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Resource</th><th className="px-4 py-3">หมู่บ้าน</th><th className="px-4 py-3">Resource ID</th></tr></thead>
            <tbody>{logs.map((log) => <tr key={log.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"><td className="whitespace-nowrap px-4 py-3 text-slate-600">{log.createdAt.toLocaleString("th-TH")}</td><td className="px-4 py-3 text-slate-700">{log.user?.name ?? log.user?.phoneNumber ?? "ระบบ"}</td><td className="px-4 py-3"><span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{log.action}</span></td><td className="px-4 py-3 font-medium text-slate-800">{log.resource}</td><td className="px-4 py-3 text-slate-700">{log.village?.name ?? "-"}</td><td className="max-w-48 break-all px-4 py-3 text-xs text-slate-500">{log.resourceId ?? "-"}</td></tr>)}{logs.length === 0 ? <tr><td colSpan={6} className="px-4 py-14 text-center"><p className="font-medium text-slate-700">ไม่พบกิจกรรมที่ตรงกับตัวกรอง</p><p className="mt-1 text-sm text-slate-500">ลองปรับคำค้นหา มุมมอง หรือช่วงวันที่</p></td></tr> : null}</tbody>
          </table>
        </div>
      </section>

      <QueryPagination pathname="/superadmin/logs" page={page} totalPages={totalPages} params={{ view, ...filterParams }} />
    </div>
  );
}

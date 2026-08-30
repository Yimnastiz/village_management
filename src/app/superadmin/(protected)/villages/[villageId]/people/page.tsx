import Link from "next/link";
import { PersonStatus, Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { personStatusBadgeVariant } from "@/features/population/person-status";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { QueryPagination } from "@/components/ui/query-pagination";
import { PERSON_STATUS_LABELS } from "@/lib/constants";
import { getWorkspaceVillage } from "@/features/village-workspace/server/queries";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

function badgeVariant(status: PersonStatus): "success" | "warning" | "default" { return personStatusBadgeVariant(status); }

export default async function Page({ params, searchParams }: { params: Promise<{ villageId: string }>; searchParams: Promise<{ q?: string; status?: string; history?: string; page?: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId } = await params;
  const search = await searchParams;
  const village = await getWorkspaceVillage(villageId);
  const base = `/superadmin/villages/${villageId}/people`;
  const keyword = (search.q ?? "").trim();
  const terms = keyword.split(/\s+/).filter(Boolean);
  const historyEnabled = search.history === "1";
  const status = (search.status ?? "ALL").trim();
  const selectedStatus = historyEnabled && status !== "ALL" && Object.values(PersonStatus).includes(status as PersonStatus) ? status as PersonStatus : null;
  const page = Math.max(1, Number(search.page ?? "1") || 1);
  const pageSize = 25;
  const where: Prisma.PersonWhereInput = { villageId, ...(!historyEnabled ? { status: PersonStatus.ACTIVE } : selectedStatus ? { status: selectedStatus } : {}), ...(keyword ? { OR: [{ phone: { contains: keyword, mode: "insensitive" } }, { AND: terms.map((term) => ({ OR: [{ firstName: { contains: term, mode: "insensitive" } }, { lastName: { contains: term, mode: "insensitive" } }] })) }] } : {}) };
  const [people, total] = await Promise.all([prisma.person.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, firstName: true, lastName: true, phone: true, status: true, house: { select: { houseNumber: true } } }, orderBy: [{ updatedAt: "desc" }] }), prisma.person.count({ where })]);
  const buildHref = (next: { q?: string; status?: string; history?: boolean }) => { const query = new URLSearchParams(); const q = (next.q ?? keyword).trim(); const nextHistory = next.history ?? historyEnabled; const nextStatus = (next.status ?? "ALL").trim(); if (q) query.set("q", q); if (nextHistory) query.set("history", "1"); if (nextHistory && nextStatus !== "ALL") query.set("status", nextStatus); const qs = query.toString(); return qs ? `${base}?${qs}` : base; };
  const actions = <div className="flex flex-wrap items-center gap-2"><Link href={buildHref({ q: keyword, status: "ALL", history: !historyEnabled })} aria-label={`${historyEnabled ? "ปิด" : "เปิด"}การแสดงทั้งหมด`} aria-pressed={historyEnabled} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"><span>ทั้งหมด</span><span className={`relative h-4 w-7 rounded-full transition-colors ${historyEnabled ? "bg-green-600" : "bg-gray-300"}`} aria-hidden="true"><span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${historyEnabled ? "translate-x-3.5" : "translate-x-0.5"}`} /></span></Link><Link href={`${base}/new`} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">เพิ่มบุคคล</Link></div>;

  return <div className="flex min-h-0 flex-col gap-3 sm:h-[calc(100dvh-var(--app-topbar-visible-offset,4rem)-2rem)] sm:overflow-visible">
    <AdminListToolbar hideHeading title="ทะเบียนประชากร" description={`ค้นหา ตรวจสอบ และจัดการข้อมูลประชากรของ ${village.name}`} searchAction={base} clearHref={buildHref({ q: "", status: "ALL", history: true })} keyword={keyword} searchLabel="ค้นหาประชากร" searchPlaceholder="ค้นหาชื่อ นามสกุล หรือเบอร์โทร" searchAlwaysVisible filtersInlineWithSearch groups={historyEnabled ? [{ label: "สถานะ", options: [{ label: "ทั้งหมด", href: buildHref({ q: keyword, status: "ALL" }), active: status === "ALL", isDefault: true }, { label: "อยู่ในทะเบียน", href: buildHref({ q: keyword, status: PersonStatus.ACTIVE }), active: selectedStatus === PersonStatus.ACTIVE }, { label: "ย้ายออก", href: buildHref({ q: keyword, status: PersonStatus.MOVED_OUT }), active: selectedStatus === PersonStatus.MOVED_OUT }, { label: "เสียชีวิต", href: buildHref({ q: keyword, status: PersonStatus.DECEASED }), active: selectedStatus === PersonStatus.DECEASED }] }] : []} actions={actions} />
    <section className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white ${people.length ? "" : "items-center justify-center"}`}>{people.length ? <div className="min-h-0 flex-1 overflow-auto"><table className="min-w-[720px] w-full text-sm"><thead className="sticky top-0 z-20 bg-gray-50 text-left text-gray-600 shadow-sm"><tr><th className="min-w-56 bg-gray-50 px-4 py-3">ชื่อ-นามสกุล</th><th className="min-w-28 whitespace-nowrap bg-gray-50 px-4 py-3">บ้านเลขที่</th><th className="min-w-36 whitespace-nowrap bg-gray-50 px-4 py-3">เบอร์โทร</th><th className="min-w-32 whitespace-nowrap bg-gray-50 px-4 py-3">สถานะ</th><th className="min-w-28 whitespace-nowrap bg-gray-50 px-4 py-3">การจัดการ</th></tr></thead><tbody>{people.map((person) => <tr key={person.id} className="group border-t border-gray-100 transition-colors hover:bg-blue-50/60 focus-within:bg-blue-50/60"><td className="px-4 py-3 font-medium text-gray-900">{person.firstName} {person.lastName}</td><td className="px-4 py-3 text-gray-700">{person.house?.houseNumber ?? "-"}</td><td className="px-4 py-3 text-gray-700">{person.phone ?? "-"}</td><td className="px-4 py-3"><Badge variant={badgeVariant(person.status)}>{PERSON_STATUS_LABELS[person.status] ?? person.status}</Badge></td><td className="px-4 py-3"><Link href={`${base}/${person.id}`} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">ดูรายละเอียด</Link></td></tr>)}</tbody></table></div> : <div className="px-4 py-10 text-center text-sm text-gray-500"><p className="font-medium text-gray-700">ไม่พบข้อมูลประชากร</p><p className="mt-1">ลองเปลี่ยนคำค้นหา หรือเปิดดูทั้งหมดเพื่อค้นหาข้อมูลประวัติ</p></div>}</section>
    <QueryPagination pathname={base} page={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} params={{ q: keyword || undefined, history: historyEnabled ? "1" : undefined, status: selectedStatus ?? undefined }} />
  </div>;
}

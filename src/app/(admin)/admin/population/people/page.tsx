import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { QueryPagination } from "@/components/ui/query-pagination";
import { PERSON_STATUS_LABELS } from "@/lib/constants";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { MembershipStatus, PersonStatus, Prisma, VillageMembershipRole } from "@prisma/client";

type PageProps = {
  searchParams?: Promise<{ q?: string; status?: string; history?: string; page?: string }>;
};

function personStatusBadgeVariant(status: PersonStatus): "success" | "warning" | "default" {
  if (status === PersonStatus.ACTIVE) return "success";
  if (status === PersonStatus.MOVED_OUT) return "warning";
  return "default";
}

export default async function PopulationPeoplePage({ searchParams }: PageProps) {
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/admin/population/people");
  if (!isAdminUser(session)) redirect(computeLandingPath(session));

  const membership = await prisma.villageMembership.findFirst({
    where: {
      userId: session.id,
      status: MembershipStatus.ACTIVE,
      role: { in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN] },
    },
    select: { villageId: true },
  });
  if (!membership) redirect(computeLandingPath(session));

  const params = (searchParams ? await searchParams : {}) ?? {};
  const keyword = (params.q ?? "").trim();
  const keywordTerms = keyword.split(/\s+/).filter(Boolean);
  const historyEnabled = params.history === "1";
  const status = (params.status ?? "ALL").trim();
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = 25;
  const normalizedStatus = historyEnabled && status !== "ALL" && Object.values(PersonStatus).includes(status as PersonStatus)
    ? status as PersonStatus
    : null;

  const where: Prisma.PersonWhereInput = {
    villageId: membership.villageId,
    ...(!historyEnabled ? { status: PersonStatus.ACTIVE } : normalizedStatus ? { status: normalizedStatus } : {}),
    ...(keyword ? {
      OR: [
        { phone: { contains: keyword, mode: "insensitive" } },
        {
          AND: keywordTerms.map((term) => ({
            OR: [
              { firstName: { contains: term, mode: "insensitive" } },
              { lastName: { contains: term, mode: "insensitive" } },
            ],
          })),
        },
      ],
    } : {}),
  };

  const [people, totalCount] = await Promise.all([
    prisma.person.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        house: { select: { houseNumber: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
    prisma.person.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasActiveCriteria = Boolean(keyword || historyEnabled || normalizedStatus);

  function buildHref(next: { q?: string; status?: string; history?: boolean }) {
    const query = new URLSearchParams();
    const q = (next.q ?? "").trim();
    const nextStatus = (next.status ?? "ALL").trim();
    const nextHistory = next.history ?? historyEnabled;
    if (q) query.set("q", q);
    if (nextHistory) query.set("history", "1");
    if (nextHistory && nextStatus !== "ALL") query.set("status", nextStatus);
    const queryString = query.toString();
    return queryString ? `/admin/population/people?${queryString}` : "/admin/population/people";
  }

  const toolbarActions = <div className="flex flex-wrap items-center gap-2">
    <Link href={buildHref({ q: keyword, status: "ALL", history: !historyEnabled })} aria-label={`${historyEnabled ? "ปิด" : "เปิด"}การแสดงทั้งหมด`} aria-pressed={historyEnabled} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
      <span>ทั้งหมด</span>
      <span className={`relative h-4 w-7 rounded-full transition-colors ${historyEnabled ? "bg-green-600" : "bg-gray-300"}`} aria-hidden="true"><span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${historyEnabled ? "translate-x-3.5" : "translate-x-0.5"}`} /></span>
    </Link>
    <Link href="/admin/population/people/new" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">เพิ่มบุคคล</Link>
  </div>;

  return (
    <div data-admin-compact-top className="flex min-h-0 flex-col gap-3 sm:h-[calc(100dvh-var(--app-topbar-visible-offset,4rem)-2rem)] sm:overflow-visible">
      <AdminListToolbar
        compact
        title="ทะเบียนประชากร"
        description="ค้นหา ตรวจสอบ และจัดการข้อมูลประชากรในหมู่บ้าน"
        searchAction="/admin/population/people"
        clearHref={buildHref({ q: keyword, status: "ALL", history: true })}
        keyword={keyword}
        searchLabel="ค้นหาประชากร"
        searchPlaceholder="ค้นหาชื่อ นามสกุล หรือเบอร์โทร"
        searchAlwaysVisible
        filtersInlineWithSearch
        groups={[
          ...(historyEnabled ? [{
            label: "สถานะ",
            options: [
              { label: "ทั้งหมด", href: buildHref({ q: keyword, status: "ALL" }), active: status === "ALL", isDefault: true },
              { label: "อยู่ในทะเบียน", href: buildHref({ q: keyword, status: PersonStatus.ACTIVE }), active: normalizedStatus === PersonStatus.ACTIVE },
              { label: "ย้ายออก", href: buildHref({ q: keyword, status: PersonStatus.MOVED_OUT }), active: normalizedStatus === PersonStatus.MOVED_OUT },
              { label: "เสียชีวิต", href: buildHref({ q: keyword, status: PersonStatus.DECEASED }), active: normalizedStatus === PersonStatus.DECEASED },
            ],
          }] : []),
        ]}
        actions={toolbarActions}
      />

      <section className={`-mx-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white sm:-mx-6 ${people.length ? "" : "items-center justify-center"}`}>
        {people.length ? <>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="min-w-[720px] w-full text-sm">
              <thead className="sticky top-0 z-20 bg-gray-50 text-left text-gray-600 shadow-sm">
                <tr>
                  <th scope="col" className="min-w-56 bg-gray-50 px-4 py-3">ชื่อ-นามสกุล</th>
                  <th scope="col" className="min-w-28 whitespace-nowrap bg-gray-50 px-4 py-3">บ้านเลขที่</th>
                  <th scope="col" className="min-w-36 whitespace-nowrap bg-gray-50 px-4 py-3">เบอร์โทร</th>
                  <th scope="col" className="min-w-28 whitespace-nowrap bg-gray-50 px-4 py-3">สถานะ</th>
                  <th scope="col" className="min-w-32 whitespace-nowrap bg-gray-50 px-4 py-3">การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => <tr key={person.id} className="group border-t border-gray-100 transition-colors hover:bg-blue-50/60 focus-within:bg-blue-50/60">
                  <td className="break-words px-4 py-3 font-medium text-gray-900">{person.firstName} {person.lastName}</td>
                  <td className="px-4 py-3 text-gray-700">{person.house?.houseNumber || "-"}</td>
                  <td className="px-4 py-3 text-gray-700">{person.phone || "-"}</td>
                  <td className="px-4 py-3"><Badge variant={personStatusBadgeVariant(person.status)}>{PERSON_STATUS_LABELS[person.status] ?? person.status}</Badge></td>
                  <td className="px-4 py-3"><Link href={`/admin/population/people/${person.id}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">ดูรายละเอียด</Link></td>
                </tr>)}
              </tbody>
            </table>
          </div>
          {totalPages > 1 ? <footer className="shrink-0 border-t border-gray-200 px-3 py-2 [&>div]:mt-0 sm:px-4">
            <QueryPagination pathname="/admin/population/people" page={page} totalPages={totalPages} params={{ q: keyword || undefined, history: historyEnabled ? "1" : undefined, status: historyEnabled && status !== "ALL" ? normalizedStatus ?? undefined : undefined }} />
          </footer> : null}
        </> : (
          <div className="px-4 py-10 text-center text-sm text-gray-500">
            {hasActiveCriteria ? <>
              <p className="font-medium text-gray-700">ไม่พบบุคคลที่ตรงกับเงื่อนไข</p>
              <p className="mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p>
            </> : <>
              <p className="font-medium text-gray-700">ยังไม่มีข้อมูลประชากร</p>
              <p className="mt-1">เพิ่มข้อมูลบุคคลเพื่อเริ่มจัดทำทะเบียนประชากร</p>
              <Link href="/admin/population/people/new" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-green-600 px-3 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">เพิ่มบุคคล</Link>
            </>}
          </div>
        )}
      </section>
    </div>
  );
}

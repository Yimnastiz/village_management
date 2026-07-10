import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { PERSON_STATUS_LABELS } from "@/lib/constants";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { PersonStatus, Prisma } from "@prisma/client";

type PageProps = {
  searchParams?: Promise<{ q?: string; status?: string }>;
};

export default async function PopulationPeoplePage({ searchParams }: PageProps) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: {
      userId: session.id,
      status: "ACTIVE",
      role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] },
    },
    select: { villageId: true },
  });
  if (!membership) redirect("/resident");

  const params = (searchParams ? await searchParams : {}) ?? {};
  const keyword = (params.q ?? "").trim();
  const status = (params.status ?? "ALL").trim();
  const normalizedStatus =
    status !== "ALL" && Object.values(PersonStatus).includes(status as PersonStatus)
      ? (status as PersonStatus)
      : null;

  const where: Prisma.PersonWhereInput = {
    villageId: membership.villageId,
    ...(normalizedStatus ? { status: normalizedStatus } : {}),
    ...(keyword
      ? {
          OR: [
            { firstName: { contains: keyword, mode: "insensitive" as const } },
            { lastName: { contains: keyword, mode: "insensitive" as const } },
            { phone: { contains: keyword, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const people = await prisma.person.findMany({
    where,
    include: {
      house: {
        select: { id: true, houseNumber: true },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  const suggestionTitles = Array.from(
    new Set(people.map((person) => `${person.firstName} ${person.lastName}`.trim()))
  ).slice(0, 12);

  function buildHref(next: { q?: string; status?: string }) {
    const query = new URLSearchParams();
    const q = (next.q ?? "").trim();
    const nextStatus = (next.status ?? "ALL").trim();
    if (q) query.set("q", q);
    if (nextStatus !== "ALL") query.set("status", nextStatus);
    const queryString = query.toString();
    return queryString ? `/admin/population/people?${queryString}` : "/admin/population/people";
  }

  return (
    <div className="space-y-6">
      <AdminListToolbar
        title="จัดการบุคคล"
        description="ค้นหาประชากรด้วยชื่อหรือเบอร์โทร และจัดการข้อมูลรายบุคคล"
        searchAction="/admin/population/people"
        clearHref="/admin/population/people"
        keyword={keyword}
        searchPlaceholder="ค้นหาจากชื่อ นามสกุล หรือเบอร์โทร"
        hiddenInputs={{ status: status === "ALL" ? "" : status }}
        suggestionTitles={suggestionTitles}
        groups={[
          {
            label: "สถานะ",
            options: [
              { label: "ทั้งหมด", href: buildHref({ q: keyword, status: "ALL" }), active: status === "ALL" },
              { label: "ACTIVE", href: buildHref({ q: keyword, status: "ACTIVE" }), active: status === "ACTIVE" },
              { label: "MOVED_OUT", href: buildHref({ q: keyword, status: "MOVED_OUT" }), active: status === "MOVED_OUT" },
              { label: "DECEASED", href: buildHref({ q: keyword, status: "DECEASED" }), active: status === "DECEASED" },
            ],
          },
        ]}
        actions={
          <Link href="/admin/population/people/new">
            <Button size="sm">เพิ่มบุคคล</Button>
          </Link>
        }
      />

      {people.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">ไม่พบบุคคลตามเงื่อนไขค้นหา</div>
      ) : (
        <div className="space-y-3">
          {people.map((person) => (
            <Link key={person.id} href={`/admin/population/people/${person.id}`} className="block rounded-xl border border-gray-200 bg-white p-4 hover:shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{person.firstName} {person.lastName}</p>
                  <p className="mt-1 text-sm text-gray-600">โทร: {person.phone || "-"} • บ้าน: {person.house?.houseNumber || "-"}</p>
                </div>
                <Badge variant={person.status === "ACTIVE" ? "success" : "warning"}>
                  {PERSON_STATUS_LABELS[person.status] ?? person.status}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { prisma } from "@/lib/prisma";
import { VILLAGE_PLACE_CATEGORY_LABELS } from "@/lib/constants";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

type PageProps = {
  searchParams?: Promise<{ q?: string; category?: string; visibility?: string; sort?: string; page?: string }>;
};

type PlaceItem = {
  id: string;
  name: string;
  category: string;
  address: string | null;
  openingHours: string | null;
  imageUrls: unknown;
  isPublic: boolean;
  createdAt: Date;
};

type VillagePlaceListDelegate = {
  findMany(args: unknown): Promise<PlaceItem[]>;
  count(args: unknown): Promise<number>;
};

type VillagePlaceSubmissionCountDelegate = {
  count(args: unknown): Promise<number>;
};

export default async function AdminPlacesPage({ searchParams }: PageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const keyword = params.q?.trim() ?? "";
  const activeCategory = params.category ?? "ALL";
  const activeVisibility = params.visibility ?? "ALL";
  const activeSort = params.sort === "oldest" || params.sort === "name_asc" || params.sort === "name_desc" ? params.sort : "newest";
  const page = Number.parseInt(params.page ?? "1", 10);
  const currentPage = Number.isNaN(page) || page < 1 ? 1 : page;
  const pageSize = 9;

  const where = {
    villageId: membership.villageId,
    ...(activeCategory !== "ALL" ? { category: activeCategory } : {}),
    ...(activeVisibility !== "ALL" ? { isPublic: activeVisibility === "PUBLIC" } : {}),
    ...(keyword
      ? {
          OR: [
            { name: { contains: keyword, mode: "insensitive" as const } },
            { description: { contains: keyword, mode: "insensitive" as const } },
            { address: { contains: keyword, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const orderBy =
    activeSort === "oldest"
      ? [{ createdAt: "asc" as const }]
      : activeSort === "name_asc"
        ? [{ name: "asc" as const }]
        : activeSort === "name_desc"
          ? [{ name: "desc" as const }]
          : [{ createdAt: "desc" as const }];

  const villagePlace = (prisma as unknown as { villagePlace: VillagePlaceListDelegate }).villagePlace;
  const villagePlaceSubmission =
    (prisma as unknown as { villagePlaceSubmission: VillagePlaceSubmissionCountDelegate }).villagePlaceSubmission;

  const [rows, totalCount, pendingRequestCount] = await Promise.all([
    villagePlace.findMany({
      where,
      orderBy,
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        category: true,
        address: true,
        openingHours: true,
        imageUrls: true,
        isPublic: true,
        createdAt: true,
      },
    }),
    villagePlace.count({ where }),
    villagePlaceSubmission.count({
      where: { villageId: membership.villageId, status: "PENDING" },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const suggestionTitles = Array.from(new Set(rows.map((item) => item.name))).slice(0, 12);

  function buildHref(next: { q?: string; category?: string; visibility?: string; sort?: string; page?: number }) {
    const query = new URLSearchParams();
    const q = next.q?.trim() ?? "";
    const category = next.category ?? "ALL";
    const visibility = next.visibility ?? "ALL";
    const sort = next.sort ?? activeSort;
    const page = next.page ?? currentPage;

    if (q) query.set("q", q);
    if (category !== "ALL") query.set("category", category);
    if (visibility !== "ALL") query.set("visibility", visibility);
    if (sort !== "newest") query.set("sort", sort);
    if (page > 1) query.set("page", String(page));

    const queryString = query.toString();
    return queryString ? `/admin/places?${queryString}` : "/admin/places";
  }

  return (
    <div className="space-y-6">
      <AdminListToolbar
        title="สถานที่สำคัญ"
        description="จัดการข้อมูลสถานที่สำคัญของหมู่บ้าน"
        searchAction="/admin/places"
        clearHref="/admin/places"
        keyword={keyword}
        searchPlaceholder="ค้นหาชื่อสถานที่หรือที่อยู่"
        hiddenInputs={{
          category: activeCategory === "ALL" ? "" : activeCategory,
          visibility: activeVisibility === "ALL" ? "" : activeVisibility,
          sort: activeSort === "newest" ? "" : activeSort,
        }}
        suggestionTitles={suggestionTitles}
        groups={[
          {
            label: "หมวดหมู่",
            options: [
              { label: "ทั้งหมด", href: buildHref({ q: keyword, category: "ALL", visibility: activeVisibility }), active: activeCategory === "ALL" },
              ...Object.entries(VILLAGE_PLACE_CATEGORY_LABELS).map(([value, label]) => ({
                label,
                href: buildHref({ q: keyword, category: value, visibility: activeVisibility }),
                active: activeCategory === value,
              })),
            ],
          },
          {
            label: "การมองเห็น",
            options: [
              { label: "ทั้งหมด", href: buildHref({ q: keyword, category: activeCategory, visibility: "ALL" }), active: activeVisibility === "ALL" },
              { label: "สาธารณะ", href: buildHref({ q: keyword, category: activeCategory, visibility: "PUBLIC" }), active: activeVisibility === "PUBLIC" },
              { label: "เฉพาะลูกบ้าน", href: buildHref({ q: keyword, category: activeCategory, visibility: "RESIDENT" }), active: activeVisibility === "RESIDENT" },
            ],
          },
          {
            label: "เรียง",
            options: [
              { label: "ล่าสุดก่อน", href: buildHref({ q: keyword, category: activeCategory, visibility: activeVisibility, sort: "newest" }), active: activeSort === "newest" },
              { label: "เก่าก่อน", href: buildHref({ q: keyword, category: activeCategory, visibility: activeVisibility, sort: "oldest" }), active: activeSort === "oldest" },
              { label: "ชื่อ ก-ฮ", href: buildHref({ q: keyword, category: activeCategory, visibility: activeVisibility, sort: "name_asc" }), active: activeSort === "name_asc" },
              { label: "ชื่อ ฮ-ก", href: buildHref({ q: keyword, category: activeCategory, visibility: activeVisibility, sort: "name_desc" }), active: activeSort === "name_desc" },
            ],
          },
        ]}
        actions={
          <>
            <Link href="/admin/places/requests">
              <Button size="sm" variant="outline">คำขอสถานที่ {pendingRequestCount > 0 ? `(${pendingRequestCount})` : ""}</Button>
            </Link>
            <Link href="/admin/places/new">
              <Button size="sm"><Plus className="mr-1 h-4 w-4" /> เพิ่มสถานที่</Button>
            </Link>
          </>
        }
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gray-600">ยังไม่มีสถานที่ในระบบ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((place) => {
            const images = Array.isArray(place.imageUrls)
              ? place.imageUrls.map((value) => String(value)).filter((url) => url.length > 0)
              : [];
            return (
              <Link
                key={place.id}
                href={`/admin/places/${place.id}`}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
              >
                <div className="aspect-video bg-gray-100">
                  {images[0] ? (
                    <img src={images[0]} alt={place.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">ไม่มีรูปภาพ</div>
                  )}
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{VILLAGE_PLACE_CATEGORY_LABELS[place.category] ?? place.category}</Badge>
                    <Badge variant={place.isPublic ? "success" : "info"}>{place.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}</Badge>
                  </div>
                  <p className="line-clamp-1 font-medium text-gray-900">{place.name}</p>
                  {place.address && <p className="line-clamp-1 text-sm text-gray-600">{place.address}</p>}
                  {place.openingHours && <p className="text-xs text-gray-500">เวลา: {place.openingHours}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link href={buildHref({ q: keyword, category: activeCategory, visibility: activeVisibility, sort: activeSort, page: Math.max(1, currentPage - 1) })} className={`rounded-lg border px-3 py-1.5 text-sm ${currentPage <= 1 ? "pointer-events-none border-gray-200 text-gray-300" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
            ก่อนหน้า
          </Link>
          <span className="text-sm text-gray-600">หน้า {currentPage} / {totalPages}</span>
          <Link href={buildHref({ q: keyword, category: activeCategory, visibility: activeVisibility, sort: activeSort, page: Math.min(totalPages, currentPage + 1) })} className={`rounded-lg border px-3 py-1.5 text-sm ${currentPage >= totalPages ? "pointer-events-none border-gray-200 text-gray-300" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
            ถัดไป
          </Link>
        </div>
      )}
    </div>
  );
}

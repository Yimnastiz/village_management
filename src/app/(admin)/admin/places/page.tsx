import Link from "next/link";
import { Building2, ListChecks, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { prisma } from "@/lib/prisma";
import { VILLAGE_PLACE_CATEGORY_LABELS } from "@/lib/constants";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { orderedPlaceImages, type PlaceImageView } from "@/lib/place-image";

type PageProps = {
  searchParams?: Promise<{ q?: string; category?: string; visibility?: string; featured?: string; sort?: string; page?: string }>;
};

type PlaceItem = {
  id: string;
  name: string;
  category: string;
  address: string | null;
  openingHours: string | null;
  imageUrls: unknown;
  images: PlaceImageView[];
  isPublic: boolean;
  isFeatured: boolean;
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
  const activeFeatured = params.featured === "1" ? "FEATURED" : "ALL";
  const activeSort = params.sort === "oldest" || params.sort === "name_asc" || params.sort === "name_desc" ? params.sort : "newest";
  const page = Number.parseInt(params.page ?? "1", 10);
  const currentPage = Number.isNaN(page) || page < 1 ? 1 : page;
  const pageSize = 9;

  const where = {
    villageId: membership.villageId,
    ...(activeCategory !== "ALL" ? { category: activeCategory } : {}),
    ...(activeVisibility !== "ALL" ? { isPublic: activeVisibility === "PUBLIC" } : {}),
    ...(activeFeatured === "FEATURED" ? { isFeatured: true } : {}),
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
        images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, fileKey: true, sortOrder: true, isCover: true } },
        isPublic: true,
        isFeatured: true,
        createdAt: true,
      },
    }),
    villagePlace.count({ where }),
    villagePlaceSubmission.count({
      where: { villageId: membership.villageId, status: "PENDING" },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  function buildHref(next: { q?: string; category?: string; visibility?: string; featured?: string; sort?: string; page?: number }) {
    const query = new URLSearchParams();
    const q = next.q?.trim() ?? "";
    const category = next.category ?? "ALL";
    const visibility = next.visibility ?? "ALL";
    const featured = next.featured ?? activeFeatured;
    const sort = next.sort ?? activeSort;
    const page = next.page ?? currentPage;

    if (q) query.set("q", q);
    if (category !== "ALL") query.set("category", category);
    if (visibility !== "ALL") query.set("visibility", visibility);
    if (featured === "FEATURED") query.set("featured", "1");
    if (sort !== "newest") query.set("sort", sort);
    if (page > 1) query.set("page", String(page));

    const queryString = query.toString();
    return queryString ? `/admin/places?${queryString}` : "/admin/places";
  }

  return (
    <div data-admin-compact-top className="space-y-3">
      <AdminListToolbar
        compact
        sticky
        title="สถานที่"
        description="จัดการข้อมูลสถานที่ของหมู่บ้าน"
        searchAction="/admin/places"
        clearHref="/admin/places"
        keyword={keyword}
        searchPlaceholder="ค้นหาชื่อสถานที่หรือที่อยู่"
        hiddenInputs={{
          category: activeCategory === "ALL" ? "" : activeCategory,
          visibility: activeVisibility === "ALL" ? "" : activeVisibility,
          featured: activeFeatured === "FEATURED" ? "1" : "",
          sort: activeSort === "newest" ? "" : activeSort,
        }}
        groups={[
          {
            label: "หมวดหมู่",
            options: [
              { label: "ทั้งหมด", href: buildHref({ q: keyword, category: "ALL", visibility: activeVisibility }), active: activeCategory === "ALL", isDefault: true },
              ...Object.entries(VILLAGE_PLACE_CATEGORY_LABELS).map(([value, label]) => ({
                label,
                href: buildHref({ q: keyword, category: value, visibility: activeVisibility }),
                active: activeCategory === value,
              })),
            ],
          },
          {
            label: "ความสำคัญ",
            options: [
              { label: "ทั้งหมด", href: buildHref({ q: keyword, category: activeCategory, visibility: activeVisibility, featured: "ALL" }), active: activeFeatured === "ALL", isDefault: true },
              { label: "สถานที่สำคัญ", href: buildHref({ q: keyword, category: activeCategory, visibility: activeVisibility, featured: "FEATURED" }), active: activeFeatured === "FEATURED" },
            ],
          },
          {
            label: "การมองเห็น",
            options: [
              { label: "ทั้งหมด", href: buildHref({ q: keyword, category: activeCategory, visibility: "ALL" }), active: activeVisibility === "ALL", isDefault: true },
              { label: "สาธารณะ", href: buildHref({ q: keyword, category: activeCategory, visibility: "PUBLIC" }), active: activeVisibility === "PUBLIC" },
              { label: "เฉพาะลูกบ้าน", href: buildHref({ q: keyword, category: activeCategory, visibility: "RESIDENT" }), active: activeVisibility === "RESIDENT" },
            ],
          },
          {
            label: "เรียง",
            options: [
              { label: "ล่าสุดก่อน", href: buildHref({ q: keyword, category: activeCategory, visibility: activeVisibility, sort: "newest" }), active: activeSort === "newest", isDefault: true },
              { label: "เก่าก่อน", href: buildHref({ q: keyword, category: activeCategory, visibility: activeVisibility, sort: "oldest" }), active: activeSort === "oldest" },
              { label: "ชื่อ ก-ฮ", href: buildHref({ q: keyword, category: activeCategory, visibility: activeVisibility, sort: "name_asc" }), active: activeSort === "name_asc" },
              { label: "ชื่อ ฮ-ก", href: buildHref({ q: keyword, category: activeCategory, visibility: activeVisibility, sort: "name_desc" }), active: activeSort === "name_desc" },
            ],
          },
        ]}
        actions={
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/admin/places/requests" aria-label={`คำขอสถานที่${pendingRequestCount > 0 ? ` ${pendingRequestCount} รายการ` : ""}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 px-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:px-3">
              <ListChecks className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:ml-1.5 sm:inline">คำขอสถานที่ {pendingRequestCount > 0 ? `(${pendingRequestCount})` : ""}</span>
            </Link>
            <Link href="/admin/places/new" aria-label="เพิ่มสถานที่" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-green-600 px-2 text-sm font-medium text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:px-3">
              <Plus className="h-4 w-4" aria-hidden="true" /><span className="hidden min-[390px]:ml-1.5 min-[390px]:inline">เพิ่มสถานที่</span>
            </Link>
          </div>
        }
      />

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="font-medium text-gray-800">{activeFeatured === "FEATURED" ? "ยังไม่มีสถานที่ที่ถูกกำหนดเป็นสถานที่สำคัญ" : keyword || activeCategory !== "ALL" || activeVisibility !== "ALL" ? "ไม่พบสถานที่ที่ตรงกับเงื่อนไข" : "ยังไม่มีสถานที่"}</p>
          <p className="mt-1 text-sm text-gray-500">{keyword || activeCategory !== "ALL" || activeVisibility !== "ALL" ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง" : "เพิ่มสถานที่เพื่อให้ลูกบ้านและประชาชนค้นหาข้อมูลได้"}</p>
          {!keyword && activeCategory === "ALL" && activeVisibility === "ALL" && activeFeatured === "ALL" && <Link href="/admin/places/new" className="mt-4 inline-flex items-center justify-center rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">เพิ่มสถานที่</Link>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-3 sm:p-4 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((place) => {
            const images = orderedPlaceImages(place.images, place.imageUrls);
            return (
              <Link
                key={place.id}
                href={`/admin/places/${place.id}`}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
              >
                <div className="aspect-video bg-gray-100">
                  {images[0] ? (
                    <img src={images[0].url} alt={place.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">ไม่มีรูปภาพ</div>
                  )}
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{VILLAGE_PLACE_CATEGORY_LABELS[place.category] ?? place.category}</Badge>
                    {place.isFeatured && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">สำคัญ</Badge>}
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
        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-gray-200 px-3 py-2 sm:px-4">
          <Link href={buildHref({ q: keyword, category: activeCategory, visibility: activeVisibility, featured: activeFeatured, sort: activeSort, page: Math.max(1, currentPage - 1) })} className={`rounded-lg border px-3 py-1.5 text-sm ${currentPage <= 1 ? "pointer-events-none border-gray-200 text-gray-300" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
            ก่อนหน้า
          </Link>
          <span className="text-sm text-gray-600">หน้า {currentPage} / {totalPages}</span>
          <Link href={buildHref({ q: keyword, category: activeCategory, visibility: activeVisibility, featured: activeFeatured, sort: activeSort, page: Math.min(totalPages, currentPage + 1) })} className={`rounded-lg border px-3 py-1.5 text-sm ${currentPage >= totalPages ? "pointer-events-none border-gray-200 text-gray-300" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
            ถัดไป
          </Link>
        </div>
      )}
      </section>
    </div>
  );
}

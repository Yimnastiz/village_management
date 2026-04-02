import Link from "next/link";
import { Building2 } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/prisma";
import { VILLAGE_PLACE_CATEGORY_LABELS } from "@/lib/constants";
import { normalizeVillageSlugParam, getSlugVariants } from "@/lib/village-slug";
import { PublicPlacesToolbar } from "./public-places-toolbar";

interface PageProps {
  params: Promise<{ villageSlug: string }>;
  searchParams?: Promise<{ q?: string; category?: string; sort?: string; page?: string }>;
}

type PlaceItem = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  address: string | null;
  openingHours: string | null;
  imageUrls: unknown;
};

type VillagePlaceListDelegate = {
  findMany(args: unknown): Promise<PlaceItem[]>;
  count(args: unknown): Promise<number>;
};

export default async function VillagePlacesPage({ params, searchParams }: PageProps) {
  const { villageSlug: rawVillageSlug } = await params;
  const villageSlug = normalizeVillageSlugParam(rawVillageSlug);

  const query = (searchParams ? await searchParams : {}) ?? {};
  const keyword = query.q?.trim() ?? "";
  const category = query.category?.trim() ?? "ALL";
  const sort = query.sort === "oldest" || query.sort === "name_asc" || query.sort === "name_desc" ? query.sort : "newest";
  const page = Number.parseInt(query.page ?? "1", 10);
  const currentPage = Number.isNaN(page) || page < 1 ? 1 : page;
  const pageSize = 9;

  const village = await prisma.village.findFirst({
    where: { slug: { in: getSlugVariants(villageSlug) } },
    select: { id: true, name: true, slug: true },
  });
  if (!village) notFound();
  const villagePathSlug = village.slug;

  const villagePlace = (prisma as unknown as { villagePlace: VillagePlaceListDelegate }).villagePlace;
  const where = {
    villageId: village.id,
    isPublic: true,
    ...(category !== "ALL" ? { category } : {}),
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
    sort === "oldest"
      ? [{ createdAt: "asc" as const }]
      : sort === "name_asc"
        ? [{ name: "asc" as const }]
        : sort === "name_desc"
          ? [{ name: "desc" as const }]
          : [{ createdAt: "desc" as const }];

  const [places, totalCount] = await Promise.all([
    villagePlace.findMany({
      where,
      orderBy,
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
        address: true,
        openingHours: true,
        imageUrls: true,
      },
    }),
    villagePlace.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const suggestionTitles = Array.from(new Set(places.map((item) => item.name))).slice(0, 12);

  function buildHref(next: { q?: string; category?: string; sort?: string; page?: number }) {
    const params = new URLSearchParams();
    const nextQ = next.q ?? keyword;
    const nextCategory = next.category ?? category;
    const nextSort = next.sort ?? sort;
    const nextPage = next.page ?? currentPage;

    if (nextQ) params.set("q", nextQ);
    if (nextCategory !== "ALL") params.set("category", nextCategory);
    if (nextSort !== "newest") params.set("sort", nextSort);
    if (nextPage > 1) params.set("page", String(nextPage));

    const qs = params.toString();
    return qs ? `/${villagePathSlug}/places?${qs}` : `/${villagePathSlug}/places`;
  }

  return (
    <div className="space-y-6">
      <PublicPlacesToolbar
        villageSlug={villagePathSlug}
        villageName={village.name}
        keyword={keyword}
        category={category}
        sort={sort}
        suggestionTitles={suggestionTitles}
      />

      {places.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="ยังไม่มีข้อมูลสถานที่สาธารณะ"
          description={keyword ? "ไม่พบสถานที่ตามคำค้นนี้" : "เมื่อแอดมินเผยแพร่ข้อมูลสถานที่แล้วจะแสดงที่นี่"}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {places.map((place) => {
            const images = Array.isArray(place.imageUrls)
              ? place.imageUrls.map((value) => String(value)).filter((url) => url.length > 0)
              : [];
            return (
              <Link
                key={place.id}
                href={`/${villagePathSlug}/places/${place.id}`}
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
                  <Badge variant="outline">{VILLAGE_PLACE_CATEGORY_LABELS[place.category] ?? place.category}</Badge>
                  <p className="line-clamp-1 font-medium text-gray-900">{place.name}</p>
                  {place.address && <p className="line-clamp-1 text-sm text-gray-600">{place.address}</p>}
                  {place.openingHours && <p className="text-xs text-gray-500">เวลา: {place.openingHours}</p>}
                  {place.description && <p className="line-clamp-2 text-sm text-gray-500">{place.description}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link href={buildHref({ page: Math.max(1, currentPage - 1) })} className={`rounded-lg border px-3 py-1.5 text-sm ${currentPage <= 1 ? "pointer-events-none border-gray-200 text-gray-300" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
            ก่อนหน้า
          </Link>
          <span className="text-sm text-gray-600">หน้า {currentPage} / {totalPages}</span>
          <Link href={buildHref({ page: Math.min(totalPages, currentPage + 1) })} className={`rounded-lg border px-3 py-1.5 text-sm ${currentPage >= totalPages ? "pointer-events-none border-gray-200 text-gray-300" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
            ถัดไป
          </Link>
        </div>
      )}
    </div>
  );
}

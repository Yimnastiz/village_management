import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normalizeVillageSlugParam, getSlugVariants } from "@/lib/village-slug";
import { PublicGalleryToolbar } from "./public-gallery-toolbar";

interface PageProps {
  params: Promise<{ villageSlug: string }>;
  searchParams?: Promise<{ q?: string; sort?: string }>;
}

export default async function Page({ params, searchParams }: PageProps) {
  const { villageSlug: rawVillageSlug } = await params;
  const villageSlug = normalizeVillageSlugParam(rawVillageSlug);
  const query = (searchParams ? await searchParams : {}) ?? {};
  const keyword = query.q?.trim() ?? "";
  const sort = query.sort === "oldest" ? "oldest" : "newest";

  const village = await prisma.village.findFirst({
    where: { slug: { in: getSlugVariants(villageSlug) } },
    select: { id: true, name: true },
  });
  if (!village) notFound();

  const albums = await prisma.galleryAlbum.findMany({
    where: {
      villageId: village.id,
      isPublic: true,
      ...(keyword
        ? {
            title: {
              contains: keyword,
              mode: "insensitive" as const,
            },
          }
        : {}),
    },
    select: {
      id: true,
      title: true,
      description: true,
      coverUrl: true,
      allowResidentSubmissions: true,
      albumDate: true,
      items: {
        select: {
          id: true,
          fileUrl: true,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        take: 1,
      },
      _count: {
        select: {
          items: true,
        },
      },
    },
    orderBy:
      sort === "oldest"
        ? [{ albumDate: "asc" }, { createdAt: "asc" }]
        : [{ albumDate: "desc" }, { createdAt: "desc" }],
  });

  const titleSuggestions = await prisma.galleryAlbum.findMany({
    where: {
      villageId: village.id,
      isPublic: true,
    },
    select: { title: true },
    orderBy: [{ albumDate: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  const suggestionTitles = Array.from(new Set(titleSuggestions.map((item) => item.title))).slice(0, 20);

  return (
    <div className="space-y-6">
      <PublicGalleryToolbar
        villageSlug={villageSlug}
        villageName={village.name}
        keyword={keyword}
        sort={sort}
        suggestionTitles={suggestionTitles}
      />

      {albums.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">ยังไม่มีอัลบั้มสาธารณะ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {albums.map((album) => (
            <Link
              key={album.id}
              href={`/${villageSlug}/gallery/${album.id}`}
              className="rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-video bg-gray-100">
                {album.coverUrl || album.items[0]?.fileUrl ? (
                  <img
                    src={album.coverUrl || album.items[0]?.fileUrl || ""}
                    alt={album.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">ไม่มีรูปหน้าปก</div>
                )}
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                    {album._count.items} รูป
                  </span>
                </div>
                <p className="font-medium text-gray-900 line-clamp-1">{album.title}</p>
                {album.description && <p className="text-sm text-gray-500 line-clamp-2">{album.description}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { normalizeVillageSlugParam, getSlugVariants } from "@/lib/village-slug";

interface PageProps {
  params: Promise<{ villageSlug: string }>;
}

export default async function Page({ params }: PageProps) {
  const { villageSlug: rawVillageSlug } = await params;
  const villageSlug = normalizeVillageSlugParam(rawVillageSlug);

  const village = await prisma.village.findFirst({
    where: { slug: { in: getSlugVariants(villageSlug) } },
    select: { id: true, name: true },
  });
  if (!village) notFound();

  const albums = await prisma.galleryAlbum.findMany({
    where: { villageId: village.id, isPublic: true },
    select: {
      id: true,
      title: true,
      description: true,
      coverUrl: true,
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
    orderBy: [{ createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">แกลเลอรีภาพ</h1>
        <p className="text-sm text-gray-500 mt-1">ภาพกิจกรรมและบรรยากาศของ {village.name}</p>
      </div>

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
                  <Badge variant="success">สาธารณะ</Badge>
                  <Badge variant="outline">{album._count.items} รูป</Badge>
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

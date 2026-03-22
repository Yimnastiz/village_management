import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{ villageSlug: string }>;
}

export default async function Page({ params }: PageProps) {
  const { villageSlug } = await params;

  const village = await prisma.village.findUnique({
    where: { slug: villageSlug },
    select: { id: true, name: true },
  });
  if (!village) notFound();

  const albums = await prisma.galleryAlbum.findMany({
    where: { villageId: village.id, isPublic: true },
    include: {
      items: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        take: 8,
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
        <div className="space-y-5">
          {albums.map((album) => (
            <section key={album.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{album.title}</h2>
                  {album.description && <p className="text-sm text-gray-600 mt-1">{album.description}</p>}
                </div>
                <Badge variant="outline">{album.items.length} รูป</Badge>
              </div>

              {album.items.length === 0 ? (
                <p className="text-sm text-gray-500">ยังไม่มีรูปภาพในอัลบั้มนี้</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {album.items.map((item) => (
                    <figure key={item.id} className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.fileUrl}
                        alt={item.title || album.title}
                        className="w-full h-32 object-cover"
                        loading="lazy"
                      />
                      <figcaption className="px-2 py-1.5 text-xs text-gray-600 line-clamp-1">
                        {item.title || "ภาพกิจกรรม"}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

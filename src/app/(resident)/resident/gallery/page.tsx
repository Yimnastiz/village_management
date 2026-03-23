import Link from "next/link";
import { Images } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

export default async function ResidentGalleryPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/auth/login");

  const village = await prisma.village.findUnique({
    where: { id: membership.villageId },
    select: { id: true, name: true },
  });
  if (!village) redirect("/auth/login");

  const albums = await prisma.galleryAlbum.findMany({
    where: { villageId: village.id },
    select: {
      id: true,
      title: true,
      description: true,
      coverUrl: true,
      isPublic: true,
      allowResidentSubmissions: true,
      _count: {
        select: {
          items: true,
        },
      },
      items: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          fileUrl: true,
        },
        take: 1,
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">แกลเลอรีภาพ</h1>
        <p className="mt-1 text-sm text-gray-500">ภาพกิจกรรมและบรรยากาศของ {village.name}</p>
      </div>

      {albums.length === 0 ? (
        <EmptyState
          icon={Images}
          title="ยังไม่มีอัลบั้มภาพ"
          description="เมื่อแอดมินเพิ่มอัลบั้มรูปแล้วจะแสดงที่นี่"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <Link
              key={album.id}
              href={`/resident/gallery/${album.id}`}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white hover:shadow-md transition-shadow"
            >
              <div className="aspect-video bg-gray-100">
                {album.coverUrl || album.items[0]?.fileUrl ? (
                  <img
                    src={album.coverUrl || album.items[0]?.fileUrl || ""}
                    alt={album.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                    ไม่มีรูปหน้าปก
                  </div>
                )}
              </div>

              <div className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={album.isPublic ? "success" : "info"}>
                    {album.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}
                  </Badge>
                  {album.allowResidentSubmissions && <Badge variant="warning">ขอเพิ่มรูปได้</Badge>}
                  <Badge variant="outline">{album._count.items} รูป</Badge>
                </div>
                <p className="font-medium text-gray-900 line-clamp-1">{album.title}</p>
                {album.description && (
                  <p className="line-clamp-2 text-sm text-gray-500">{album.description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
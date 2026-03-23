import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { DeleteAlbumButton } from "./delete-album-button";
import { DeleteGalleryItemButton } from "./delete-item-button";

const db = prisma as any;

interface PageProps {
  params: Promise<{ albumId: string }>;
}

export default async function GalleryAlbumDetailPage({ params }: PageProps) {
  const { albumId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const album = await db.galleryAlbum.findFirst({
    where: { id: albumId, villageId: membership.villageId },
    include: {
      items: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      },
      _count: {
        select: {
          itemSubmissions: {
            where: {
              status: "PENDING",
            },
          },
        },
      },
    },
  });
  if (!album) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{album.title}</h1>
          <p className="text-sm text-gray-500 mt-1">จัดการรายละเอียดอัลบั้มและรูปภาพ</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/gallery/${album.id}/edit`}>
            <Button variant="outline">แก้ไขอัลบั้ม</Button>
          </Link>
          <Link href={`/admin/gallery/submissions?albumId=${album.id}`}>
            <Button variant="outline">
              คำขอเพิ่มรูป {album._count.itemSubmissions > 0 ? `(${album._count.itemSubmissions})` : ""}
            </Button>
          </Link>
          <Link href={`/admin/gallery/${album.id}/items/new`}>
            <Button>เพิ่มรูปภาพ</Button>
          </Link>
          <DeleteAlbumButton albumId={album.id} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant={album.isPublic ? "success" : "info"}>
            {album.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}
          </Badge>
          <Badge variant={album.allowResidentSubmissions ? "warning" : "default"}>
            {album.allowResidentSubmissions ? "ลูกบ้านขอเพิ่มรูปได้" : "ปิดรับคำขอเพิ่มรูป"}
          </Badge>
        </div>
        {album.description && <p className="text-sm text-gray-700 whitespace-pre-wrap">{album.description}</p>}
        {album.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={album.coverUrl} alt={album.title} className="w-full max-w-xl rounded-lg border border-gray-200" />
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">รูปภาพในอัลบั้ม ({album.items.length})</h2>
        {album.items.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-sm text-gray-500">ยังไม่มีรูปภาพ</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {album.items.map((item: any) => (
              <div key={item.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="aspect-video bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.fileUrl} alt={item.title || "gallery item"} className="w-full h-full object-cover" />
                </div>
                <div className="p-3 space-y-2">
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.title || "(ไม่มีหัวข้อ)"}</p>
                  <p className="text-xs text-gray-500">ลำดับ: {item.sortOrder}</p>
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/gallery/${album.id}/items/${item.id}/edit`}>
                      <Button variant="outline" size="sm">แก้ไข</Button>
                    </Link>
                    <DeleteGalleryItemButton albumId={album.id} itemId={item.id} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

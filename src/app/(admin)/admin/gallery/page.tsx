import Link from "next/link";
import { ImagePlus, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

const db = prisma as any;

export default async function AdminGalleryPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const albums = await db.galleryAlbum.findMany({
    where: { villageId: membership.villageId },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      coverUrl: true,
      isPublic: true,
      allowResidentSubmissions: true,
      _count: { select: { items: true } },
    },
  });

  const pendingSubmissionCount = await db.galleryItemSubmission.count({
    where: {
      album: { villageId: membership.villageId },
      status: "PENDING",
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">แกลเลอรี</h1>
          <p className="text-sm text-gray-500 mt-1">จัดการอัลบั้มและรูปภาพของหมู่บ้าน</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/gallery/submissions">
            <Button size="sm" variant="outline">
              คำขอเพิ่มรูป {pendingSubmissionCount > 0 ? `(${pendingSubmissionCount})` : ""}
            </Button>
          </Link>
          <Link href="/admin/gallery/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> เพิ่มอัลบั้ม
            </Button>
          </Link>
        </div>
      </div>

      {albums.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <ImagePlus className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">ยังไม่มีอัลบั้มรูปภาพ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {albums.map((album: any) => (
            <Link
              key={album.id}
              href={`/admin/gallery/${album.id}`}
              className="rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-video bg-gray-100">
                {album.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">ไม่มีรูปหน้าปก</div>
                )}
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={album.isPublic ? "success" : "info"}>
                    {album.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}
                  </Badge>
                  {album.allowResidentSubmissions && (
                    <Badge variant="warning">รับคำขอรูป</Badge>
                  )}
                  <Badge variant="outline">{album._count.items} รูป</Badge>
                </div>
                <p className="font-medium text-gray-900 line-clamp-1">{album.title}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { DeleteAlbumButton } from "./delete-album-button";
import { formatThaiDate } from "@/lib/utils";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { AlbumGalleryViewer } from "@/components/gallery/album-gallery-viewer";

interface PageProps { params: Promise<{ albumId: string }> }

export default async function GalleryAlbumDetailPage({ params }: PageProps) {
  const { albumId } = await params;
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");
  const membership = await prisma.villageMembership.findFirst({ where: { userId: session.id, status: "ACTIVE" }, select: { villageId: true } });
  if (!membership) redirect("/auth/login");
  const album = await prisma.galleryAlbum.findFirst({
    where: { id: albumId, villageId: membership.villageId },
    include: {
      items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, title: true, fileUrl: true, isCover: true } },
      _count: { select: { itemSubmissions: { where: { status: "PENDING" } } } },
    },
  });
  if (!album) notFound();

  return <div data-admin-compact-top className="mx-auto w-full max-w-6xl space-y-6 px-1 sm:px-0">
    <AdminPageToolbar sticky variant="detail" backHref="/admin/gallery" backLabel="กลับรายการแกลเลอรี" backPlacement="header-end" title={album.title} description="รายละเอียดอัลบั้มและรูปภาพ" actions={<div className="flex flex-wrap items-center gap-2"><Link href={`/admin/gallery/${album.id}/edit`} className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">แก้ไขอัลบั้ม</Link><Link href={`/admin/gallery/submissions?albumId=${album.id}`} className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">คำขอเพิ่มรูป{album._count.itemSubmissions > 0 ? ` (${album._count.itemSubmissions})` : ""}</Link><Link href={`/admin/gallery/${album.id}/items/new`} className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">เพิ่มรูปภาพ</Link><DeleteAlbumButton albumId={album.id} /></div>} />
    <article className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2"><Badge variant={album.isPublic ? "success" : "info"}>{album.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}</Badge><Badge variant={album.allowResidentSubmissions ? "warning" : "default"}>{album.allowResidentSubmissions ? "ลูกบ้านขอเพิ่มรูปได้" : "ปิดรับคำขอเพิ่มรูป"}</Badge><Badge variant="outline">{album.items.length} รูป</Badge></div>
      <p className="text-sm text-gray-500">วันที่อัลบั้ม {formatThaiDate(album.albumDate)}</p>
      {album.description && <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{album.description}</p>}
      <AlbumGalleryViewer items={album.items} />
    </article>
  </div>;
}

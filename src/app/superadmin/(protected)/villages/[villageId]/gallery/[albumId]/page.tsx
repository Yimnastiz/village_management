import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { AlbumGalleryViewer } from "@/components/gallery/album-gallery-viewer";
import { prisma } from "@/lib/prisma";
import { formatThaiDate, formatThaiDateTime } from "@/lib/utils";
import { SuperAdminDeleteAlbumButton, SuperAdminDeleteItemButton } from "../superadmin-gallery-actions";

export default async function GalleryAlbumDetail({ params }: { params: Promise<{ villageId: string; albumId: string }> }) {
  const { villageId, albumId } = await params;
  const album = await prisma.galleryAlbum.findFirst({ where: { id: albumId, villageId }, include: { items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, title: true, fileUrl: true, fileKey: true, isCover: true, sortOrder: true } }, _count: { select: { itemSubmissions: { where: { status: "PENDING" } } } } } });
  if (!album) notFound();
  const base = `/superadmin/villages/${villageId}/gallery`;
  return <div className="workspace-list-page -mt-4 mx-auto w-full max-w-6xl sm:-mt-6">
    <SuperAdminPageHeaderRegistration priority={1} context={{ title: album.title, description: "รายละเอียดอัลบั้มและรูปภาพ" }} />
    <AdminPageToolbar sticky hideHeading variant="detail" backHref={base} backLabel="กลับรายการแกลเลอรี" title={album.title} description="รายละเอียดอัลบั้มและรูปภาพ" actions={<div className="flex flex-wrap gap-2"><Link href={`${base}/${album.id}/edit`} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">แก้ไขอัลบั้ม</Link><Link href={`${base}/${album.id}/items/new`} className="rounded-lg bg-green-600 px-3 py-2 text-sm text-white">เพิ่มรูปภาพ</Link><SuperAdminDeleteAlbumButton villageId={villageId} albumId={album.id} /></div>} />
    <article className="mt-4 min-w-0 space-y-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"><div className="flex flex-wrap gap-2"><Badge variant={album.isPublic ? "success" : "info"}>{album.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}</Badge><Badge variant={album.allowResidentSubmissions ? "warning" : "default"}>{album.allowResidentSubmissions ? "รับคำขอรูป" : "ปิดรับคำขอ"}</Badge><Badge variant="outline">{album.items.length} รูป</Badge></div><p className="text-sm text-gray-500">วันที่อัลบั้ม {formatThaiDate(album.albumDate)} · สร้างเมื่อ {formatThaiDateTime(album.createdAt)} · แก้ไขล่าสุด {formatThaiDateTime(album.updatedAt)}</p>{album.description ? <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">{album.description}</p> : null}<AlbumGalleryViewer items={album.items} /><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{album.items.map((item) => <div key={item.id} className="rounded-lg border border-gray-200 p-2"><p className="truncate text-sm">{item.title || "ไม่มีคำอธิบาย"}</p><div className="mt-2 flex flex-wrap justify-end gap-2"><Link href={`${base}/${album.id}/items/${item.id}/edit`} className="rounded border border-gray-200 px-2 py-1 text-xs">แก้ไข</Link><SuperAdminDeleteItemButton villageId={villageId} albumId={album.id} itemId={item.id} /></div></div>)}</div></article>
  </div>;
}

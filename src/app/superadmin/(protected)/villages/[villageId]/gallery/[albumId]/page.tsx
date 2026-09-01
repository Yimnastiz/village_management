import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { AlbumGalleryViewer } from "@/components/gallery/album-gallery-viewer";
import { prisma } from "@/lib/prisma";
import { formatThaiDate, formatThaiDateTime } from "@/lib/utils";
import { SuperAdminDeleteAlbumButton } from "../superadmin-gallery-actions";
export default async function GalleryAlbumDetail({ params }: { params: Promise<{ villageId: string; albumId: string }> }) {
  const { villageId, albumId } = await params;
  const album = await prisma.galleryAlbum.findFirst({ where: { id: albumId, villageId }, include: { items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, title: true, fileUrl: true, fileKey: true, isCover: true, sortOrder: true } }, _count: { select: { itemSubmissions: { where: { status: "PENDING" } } } } } });
  if (!album) notFound(); const base = `/superadmin/villages/${villageId}/gallery`; const detailDescription = "รายละเอียดอัลบั้มและรูปภาพ";
  return <div className="workspace-list-page -mt-4 mx-auto w-full max-w-6xl sm:-mt-6"><SuperAdminPageHeaderRegistration priority={1} context={{ title: album.title, description: detailDescription }} /><AdminPageToolbar sticky hideHeading variant="detail" title={album.title} description={detailDescription} actions={<div className="flex w-full flex-wrap items-center gap-2"><Link href={base} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" aria-hidden="true" />กลับรายการแกลเลอรี</Link><div className="ml-auto flex flex-wrap gap-2"><Link href={`${base}/${album.id}/items/new`} className="inline-flex min-h-9 items-center rounded-lg bg-green-600 px-3 text-sm text-white">เพิ่มรูปภาพ</Link><Link href={`${base}/${album.id}/edit`} className="inline-flex min-h-9 items-center rounded-lg border border-gray-200 px-3 text-sm">แก้ไขอัลบั้ม</Link><SuperAdminDeleteAlbumButton villageId={villageId} albumId={album.id} /></div></div>} className="py-2 sm:py-2" /><article className="mt-3 min-w-0 space-y-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"><div className="flex flex-wrap gap-2"><Badge variant={album.isPublic ? "success" : "info"}>{album.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}</Badge><Badge variant={album.allowResidentSubmissions ? "warning" : "default"}>{album.allowResidentSubmissions ? "รับคำขอรูป" : "ปิดรับคำขอ"}</Badge><Badge variant="outline">{album.items.length} รูป</Badge></div><p className="text-sm text-gray-500">วันที่อัลบั้ม {formatThaiDate(album.albumDate)} · สร้างเมื่อ {formatThaiDateTime(album.createdAt)} · แก้ไขล่าสุด {formatThaiDateTime(album.updatedAt)}</p>{album.description ? <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">{album.description}</p> : null}<AlbumGalleryViewer items={album.items} /></article></div>;
}

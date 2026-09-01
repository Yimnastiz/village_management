import { notFound } from "next/navigation";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { prisma } from "@/lib/prisma";
import { formatDateInputValue } from "@/lib/utils";
import { SuperAdminAlbumForm } from "../../superadmin-gallery-form";

export default async function EditGalleryAlbum({ params }: { params: Promise<{ villageId: string; albumId: string }> }) {
  const { villageId, albumId } = await params;
  const album = await prisma.galleryAlbum.findFirst({ where: { id: albumId, villageId }, include: { items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, fileUrl: true, fileKey: true, title: true, sortOrder: true, isCover: true, mimeType: true } } } });
  if (!album) notFound();
  return <div className="workspace-list-page -mt-4 sm:-mt-6">
    <SuperAdminPageHeaderRegistration priority={1} context={{ title: "แก้ไขอัลบั้ม", description: "อัปเดตข้อมูลอัลบั้มและรูปภาพ" }} />
    <AdminPageToolbar sticky hideHeading variant="form" backHref={`/superadmin/villages/${villageId}/gallery/${album.id}`} backLabel="กลับรายละเอียดอัลบั้ม" title="แก้ไขอัลบั้ม" description="อัปเดตข้อมูลอัลบั้มและรูปภาพ" />
    <div className="mt-4"><SuperAdminAlbumForm villageId={villageId} albumId={album.id} defaultValues={{ title: album.title, description: album.description || "", albumDate: formatDateInputValue(album.albumDate), isPublic: album.isPublic ? "PUBLIC" : "RESIDENT", allowResidentSubmissions: album.allowResidentSubmissions ? "ALLOW" : "DISALLOW" }} initialItems={album.items.map((item) => ({ id: item.id, url: item.fileUrl, fileKey: item.fileKey ?? undefined, mimeType: item.mimeType ?? undefined, description: item.title ?? "", sortOrder: item.sortOrder, isCover: item.isCover }))} /></div>
  </div>;
}


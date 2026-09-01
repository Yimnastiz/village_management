import { notFound } from "next/navigation";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { prisma } from "@/lib/prisma";
import { SuperAdminItemForm } from "../../../superadmin-gallery-form";

export default async function NewGalleryItems({ params }: { params: Promise<{ villageId: string; albumId: string }> }) {
  const { villageId, albumId } = await params;
  const album = await prisma.galleryAlbum.findFirst({ where: { id: albumId, villageId }, select: { id: true, title: true, _count: { select: { items: true } } } });
  if (!album) notFound();
  return <div className="workspace-list-page -mt-4 sm:-mt-6">
    <SuperAdminPageHeaderRegistration priority={1} context={{ title: "เพิ่มรูปภาพ", description: `อัลบั้ม: ${album.title}` }} />
    <AdminPageToolbar sticky hideHeading variant="form" backHref={`/superadmin/villages/${villageId}/gallery/${album.id}`} backLabel="กลับรายละเอียดอัลบั้ม" title="เพิ่มรูปภาพ" description={`อัลบั้ม: ${album.title}`} />
    <div className="mt-4"><SuperAdminItemForm villageId={villageId} albumId={album.id} hasExistingItems={album._count.items > 0} /></div>
  </div>;
}


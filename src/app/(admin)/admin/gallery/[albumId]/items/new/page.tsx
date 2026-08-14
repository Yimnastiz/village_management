import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { ItemForm } from "../../../item-form";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";

interface PageProps {
  params: Promise<{ albumId: string }>;
}

export default async function NewGalleryItemPage({ params }: PageProps) {
  const { albumId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const album = await prisma.galleryAlbum.findFirst({
    where: { id: albumId, villageId: membership.villageId },
    select: { id: true, title: true, _count: { select: { items: true } } },
  });
  if (!album) notFound();

  return (
    <div data-admin-compact-top className="space-y-4">
      <AdminPageToolbar variant="form" backHref={`/admin/gallery/${album.id}`} backLabel="กลับรายละเอียดอัลบั้ม" backPlacement="header-end" title="เพิ่มรูปภาพ" description={`อัลบั้ม: ${album.title}`} />
      <ItemForm mode="create" albumId={album.id} hasExistingItems={album._count.items > 0} />
    </div>
  );
}

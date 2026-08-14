import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { AlbumForm } from "../../album-form";
import { formatDateInputValue } from "@/lib/utils";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";

const db = prisma;

interface PageProps {
  params: Promise<{ albumId: string }>;
}

export default async function EditGalleryAlbumPage({ params }: PageProps) {
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
  });
  if (!album) notFound();

  return (
    <div data-admin-compact-top className="space-y-4">
      <AdminPageToolbar variant="form" backHref={`/admin/gallery/${album.id}`} backLabel="กลับรายละเอียดอัลบั้ม" backPlacement="header-end" title="แก้ไขอัลบั้ม" description="อัปเดตข้อมูลอัลบั้มรูปภาพ" />
      <AlbumForm
        mode="edit"
        albumId={album.id}
        defaultValues={{
          title: album.title,
          description: album.description || "",
          albumDate: formatDateInputValue(album.albumDate),
          coverUrl: album.coverUrl || "",
          isPublic: album.isPublic ? "PUBLIC" : "RESIDENT",
          allowResidentSubmissions: album.allowResidentSubmissions ? "ALLOW" : "DISALLOW",
        }}
      />
    </div>
  );
}

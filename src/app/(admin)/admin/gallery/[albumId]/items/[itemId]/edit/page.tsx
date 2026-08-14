import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { ItemForm } from "../../../../item-form";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";

interface PageProps {
  params: Promise<{ albumId: string; itemId: string }>;
}

export default async function EditGalleryItemPage({ params }: PageProps) {
  const { albumId, itemId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const item = await prisma.galleryItem.findFirst({
    where: {
      id: itemId,
      albumId,
      album: { villageId: membership.villageId },
    },
  });
  if (!item) notFound();

  return (
    <div data-admin-compact-top className="space-y-4">
      <AdminPageToolbar sticky variant="form" backHref={`/admin/gallery/${albumId}`} backLabel="กลับรายละเอียดอัลบั้ม" backPlacement="header-end" title="แก้ไขรูปภาพ" description="อัปเดตข้อมูลรูปภาพในอัลบั้ม" />
      <ItemForm
        mode="edit"
        albumId={albumId}
        itemId={item.id}
        defaultValues={{
          title: item.title || "",
          fileUrl: item.fileUrl,
          fileKey: item.fileKey ?? undefined,
          mimeType: item.mimeType || "",
          sortOrder: String(item.sortOrder),
          isCover: item.isCover,
        }}
      />
    </div>
  );
}

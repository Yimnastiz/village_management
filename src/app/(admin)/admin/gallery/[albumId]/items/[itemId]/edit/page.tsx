import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { ItemForm } from "../../../../item-form";

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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">แก้ไขรูปภาพ</h1>
        <p className="text-sm text-gray-500 mt-1">อัปเดตข้อมูลรูปภาพในอัลบั้ม</p>
      </div>
      <ItemForm
        mode="edit"
        albumId={albumId}
        itemId={item.id}
        defaultValues={{
          title: item.title || "",
          fileUrl: item.fileUrl,
          mimeType: item.mimeType || "",
          sortOrder: String(item.sortOrder),
        }}
      />
    </div>
  );
}

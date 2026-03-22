import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { ItemForm } from "../../../item-form";

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
    select: { id: true, title: true },
  });
  if (!album) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">เพิ่มรูปภาพ</h1>
        <p className="text-sm text-gray-500 mt-1">อัลบั้ม: {album.title}</p>
      </div>
      <ItemForm mode="create" albumId={album.id} />
    </div>
  );
}

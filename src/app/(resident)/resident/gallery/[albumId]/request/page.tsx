import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { GallerySubmissionForm } from "./request-form";

const db = prisma as any;

type ResidentGalleryRequestPageProps = {
  params: Promise<{ albumId: string }>;
};

export default async function ResidentGalleryRequestPage({ params }: ResidentGalleryRequestPageProps) {
  const { albumId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/auth/login");

  const album = await db.galleryAlbum.findFirst({
    where: {
      id: albumId,
      villageId: membership.villageId,
    },
    select: {
      id: true,
      title: true,
      allowResidentSubmissions: true,
    },
  });

  if (!album) notFound();

  if (!album.allowResidentSubmissions) {
    redirect(`/resident/gallery/${album.id}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ส่งคำขอเพิ่มรูปภาพ</h1>
          <p className="mt-1 text-sm text-gray-500">อัลบั้ม: {album.title}</p>
        </div>
        <Link href={`/resident/gallery/${album.id}`} className="text-sm text-gray-600 hover:text-gray-900 hover:underline">
          กลับอัลบั้ม
        </Link>
      </div>

      <GallerySubmissionForm albumId={album.id} />
    </div>
  );
}

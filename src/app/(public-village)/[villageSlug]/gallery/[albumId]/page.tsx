import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { normalizeVillageSlugParam } from "@/lib/village-slug";
import { AlbumGalleryViewer } from "./album-gallery-viewer";

type PublicGalleryAlbumDetailPageProps = {
  params: Promise<{ villageSlug: string; albumId: string }>;
};

export default async function PublicGalleryAlbumDetailPage({ params }: PublicGalleryAlbumDetailPageProps) {
  const { villageSlug: rawVillageSlug, albumId } = await params;
  const villageSlug = normalizeVillageSlugParam(rawVillageSlug);

  const village = await prisma.village.findUnique({
    where: { slug: villageSlug },
    select: { id: true, name: true, slug: true },
  });
  if (!village) notFound();

  const album = await prisma.galleryAlbum.findFirst({
    where: {
      id: albumId,
      villageId: village.id,
      isPublic: true,
    },
    include: {
      items: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          fileUrl: true,
        },
      },
    },
  });

  if (!album) notFound();

  return (
    <div className="space-y-6">
      <Link
        href={`/${village.slug}/gallery`}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> กลับหน้าแกลเลอรี
      </Link>

      <article className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <Badge variant="success">สาธารณะ</Badge>
          <Badge variant="outline">{album.items.length} รูป</Badge>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">{album.title}</h1>
        {album.description && <p className="text-sm text-gray-600">{album.description}</p>}

        <AlbumGalleryViewer items={album.items} />
      </article>
    </div>
  );
}

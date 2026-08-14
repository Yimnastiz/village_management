import Link from "next/link";
import { Images } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getResidentVillageAccess, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { formatThaiShortDate } from "@/lib/utils";
import { ResidentGalleryToolbar } from "./resident-gallery-toolbar";
import { residentAlbumWhere } from "@/lib/resident-content-access";

type ResidentGalleryPageProps = {
  searchParams?: Promise<{ q?: string; sort?: string; visibility?: string; allowSubmissions?: string }>;
};

export default async function ResidentGalleryPage({ searchParams }: ResidentGalleryPageProps) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = await getResidentVillageAccess(session);
  if (!membership) redirect("/resident/dashboard");

  const query = (searchParams ? await searchParams : {}) ?? {};
  const keyword = query.q?.trim() ?? "";
  const sort = query.sort === "oldest" ? "oldest" : "newest";
  const visibilityParam = (query.visibility ?? "").trim();
  const requestedVisibilities = Array.from(
    new Set(
      visibilityParam
        .split(",")
        .map((value) => value.trim())
        .filter((value): value is "PUBLIC" | "RESIDENT_ONLY" =>
          value === "PUBLIC" || value === "RESIDENT_ONLY"
        )
    )
  );
  const selectedVisibilities = membership.hasResidentAccess ? requestedVisibilities : [];
  const allowSubmissionsOnly = membership.hasResidentAccess && query.allowSubmissions === "1";

  const village = await prisma.village.findUnique({
    where: { id: membership.villageId },
    select: { id: true, name: true },
  });
  if (!village) redirect("/auth/login");

  const albums = await prisma.galleryAlbum.findMany({
    where: {
      villageId: village.id,
      ...residentAlbumWhere(membership.hasResidentAccess),
      ...(membership.hasResidentAccess && selectedVisibilities.length === 1
        ? { isPublic: selectedVisibilities[0] === "PUBLIC" }
        : {}),
      ...(allowSubmissionsOnly ? { allowResidentSubmissions: true } : {}),
      ...(keyword
        ? {
            title: {
              contains: keyword,
              mode: "insensitive" as const,
            },
          }
        : {}),
    },
    select: {
      id: true,
      title: true,
      description: true,
      coverUrl: true,
      albumDate: true,
      isPublic: true,
      allowResidentSubmissions: true,
      _count: {
        select: {
          items: true,
        },
      },
      items: {
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          fileUrl: true,
          isCover: true,
        },
        take: 1,
      },
    },
    orderBy:
      sort === "oldest"
        ? [{ albumDate: "asc" }, { createdAt: "asc" }]
        : [{ albumDate: "desc" }, { createdAt: "desc" }],
  });

  const titleSuggestions = await prisma.galleryAlbum.findMany({
    where: { villageId: village.id, ...residentAlbumWhere(membership.hasResidentAccess) },
    select: { title: true },
    orderBy: [{ albumDate: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  const suggestionTitles = Array.from(new Set(titleSuggestions.map((item) => item.title))).slice(0, 20);

  return (
    <div className="space-y-4 sm:space-y-5">
      <ResidentGalleryToolbar
        keyword={keyword}
        sort={sort}
        villageName={village.name}
        selectedVisibilities={selectedVisibilities}
        allowSubmissionsOnly={allowSubmissionsOnly}
        suggestionTitles={suggestionTitles}
        canSubmit={membership.hasResidentAccess}
        hasResidentAccess={membership.hasResidentAccess}
      />

      {albums.length === 0 ? (
        <EmptyState
          icon={Images}
          title={keyword || selectedVisibilities.length || allowSubmissionsOnly ? "ไม่พบอัลบั้มที่ตรงกับเงื่อนไข" : "ยังไม่มีอัลบั้มภาพ"}
          description={keyword || selectedVisibilities.length || allowSubmissionsOnly ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง" : "เมื่อผู้ดูแลหมู่บ้านเพิ่มอัลบั้มแล้วจะแสดงที่นี่"}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <Link
              key={album.id}
              href={`/resident/gallery/${album.id}`}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white hover:shadow-md transition-shadow"
            >
              <div className="aspect-video bg-gray-100">
                {album.items[0]?.fileUrl || album.coverUrl ? (
                  <img
                    src={album.items[0]?.fileUrl || album.coverUrl || ""}
                    alt={album.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                    ไม่มีรูปหน้าปก
                  </div>
                )}
              </div>

              <div className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {membership.hasResidentAccess ? <Badge variant={album.isPublic ? "success" : "info"}>
                    {album.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}
                  </Badge> : null}
                  {membership.hasResidentAccess && album.allowResidentSubmissions && <Badge variant="warning">ขอเพิ่มรูปได้</Badge>}
                  <Badge variant="outline">{album._count.items} รูป</Badge>
                </div>
                <p className="font-medium text-gray-900 line-clamp-1">{album.title}</p>
                <p className="text-xs text-gray-500">วันที่อัลบั้ม {formatThaiShortDate(album.albumDate)}</p>
                {album.description && (
                  <p className="line-clamp-2 text-sm text-gray-500">{album.description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

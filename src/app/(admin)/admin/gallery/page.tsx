import Link from "next/link";
import { ImagePlus, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { formatThaiShortDate } from "@/lib/utils";

const db = prisma as any;

type PageProps = {
  searchParams?: Promise<{ q?: string; visibility?: string; submissions?: string; sort?: string }>;
};

export default async function AdminGalleryPage({ searchParams }: PageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const keyword = params.q?.trim() ?? "";
  const activeVisibility = params.visibility ?? "ALL";
  const activeSubmissions = params.submissions ?? "ALL";
  const activeSort = params.sort ?? "newest";

  const where: Prisma.GalleryAlbumWhereInput = { villageId: membership.villageId };
  if (activeVisibility === "PUBLIC") {
    where.isPublic = true;
  } else if (activeVisibility === "RESIDENT_ONLY") {
    where.isPublic = false;
  }
  if (activeSubmissions === "OPEN") {
    where.allowResidentSubmissions = true;
  }
  if (keyword) {
    where.OR = [
      { title: { contains: keyword, mode: "insensitive" } },
      { description: { contains: keyword, mode: "insensitive" } },
    ];
  }

  const albums = await db.galleryAlbum.findMany({
    where,
    orderBy: activeSort === "oldest" ? [{ albumDate: "asc" }, { createdAt: "asc" }] : [{ albumDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      coverUrl: true,
      albumDate: true,
      isPublic: true,
      allowResidentSubmissions: true,
      _count: { select: { items: true } },
    },
  });

  const pendingSubmissionCount = await db.galleryItemSubmission.count({
    where: {
      album: { villageId: membership.villageId },
      status: "PENDING",
    },
  });

  const suggestionTitles = Array.from(
    new Set(
      (albums as Array<{ title?: unknown }>).reduce<string[]>((titles, album) => {
        if (typeof album.title === "string" && album.title) {
          titles.push(album.title);
        }
        return titles;
      }, []),
    ),
  ).slice(0, 12);

  function buildGalleryHref(next: { q?: string; visibility?: string; submissions?: string; sort?: string }) {
    const query = new URLSearchParams();
    const q = next.q?.trim() ?? "";
    const visibility = next.visibility ?? "ALL";
    const submissions = next.submissions ?? "ALL";
    const sort = next.sort ?? "newest";
    if (q) query.set("q", q);
    if (visibility !== "ALL") query.set("visibility", visibility);
    if (submissions !== "ALL") query.set("submissions", submissions);
    if (sort !== "newest") query.set("sort", sort);
    const queryString = query.toString();
    return queryString ? `/admin/gallery?${queryString}` : "/admin/gallery";
  }

  return (
    <div className="space-y-6">
      <AdminListToolbar
        title="แกลเลอรี"
        description="จัดการอัลบั้มและรูปภาพของหมู่บ้าน"
        searchAction="/admin/gallery"
        keyword={keyword}
        searchPlaceholder="ค้นหาชื่ออัลบั้มหรือคำอธิบาย"
        hiddenInputs={{ visibility: activeVisibility === "ALL" ? "" : activeVisibility, submissions: activeSubmissions === "ALL" ? "" : activeSubmissions, sort: activeSort === "newest" ? "" : activeSort }}
        suggestionTitles={suggestionTitles}
        groups={[
          {
            label: "การมองเห็น",
            options: [
              { label: "ทั้งหมด", href: buildGalleryHref({ q: keyword, visibility: "ALL", submissions: activeSubmissions, sort: activeSort }), active: activeVisibility === "ALL" },
              { label: "สาธารณะ", href: buildGalleryHref({ q: keyword, visibility: "PUBLIC", submissions: activeSubmissions, sort: activeSort }), active: activeVisibility === "PUBLIC" },
              { label: "ลูกบ้าน", href: buildGalleryHref({ q: keyword, visibility: "RESIDENT_ONLY", submissions: activeSubmissions, sort: activeSort }), active: activeVisibility === "RESIDENT_ONLY" },
            ],
          },
          {
            label: "รับรูป",
            options: [
              { label: "ทั้งหมด", href: buildGalleryHref({ q: keyword, visibility: activeVisibility, submissions: "ALL", sort: activeSort }), active: activeSubmissions === "ALL" },
              { label: "เปิดรับคำขอ", href: buildGalleryHref({ q: keyword, visibility: activeVisibility, submissions: "OPEN", sort: activeSort }), active: activeSubmissions === "OPEN" },
            ],
          },
          {
            label: "เรียง",
            options: [
              { label: "ล่าสุดก่อน", href: buildGalleryHref({ q: keyword, visibility: activeVisibility, submissions: activeSubmissions, sort: "newest" }), active: activeSort === "newest" },
              { label: "เก่าก่อน", href: buildGalleryHref({ q: keyword, visibility: activeVisibility, submissions: activeSubmissions, sort: "oldest" }), active: activeSort === "oldest" },
            ],
          },
        ]}
        actions={
          <>
            <Link href="/admin/gallery/submissions">
              <Button size="sm" variant="outline">
                คำขอเพิ่มรูป {pendingSubmissionCount > 0 ? `(${pendingSubmissionCount})` : ""}
              </Button>
            </Link>
            <Link href="/admin/gallery/new">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> เพิ่มอัลบั้ม
              </Button>
            </Link>
          </>
        }
      />

      {albums.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <ImagePlus className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">ยังไม่มีอัลบั้มรูปภาพ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {albums.map((album: any) => (
            <Link
              key={album.id}
              href={`/admin/gallery/${album.id}`}
              className="rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-video bg-gray-100">
                {album.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">ไม่มีรูปหน้าปก</div>
                )}
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={album.isPublic ? "success" : "info"}>
                    {album.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}
                  </Badge>
                  {album.allowResidentSubmissions && (
                    <Badge variant="warning">รับคำขอรูป</Badge>
                  )}
                  <Badge variant="outline">{album._count.items} รูป</Badge>
                </div>
                <p className="font-medium text-gray-900 line-clamp-1">{album.title}</p>
                <p className="text-xs text-gray-500">วันที่อัลบั้ม {formatThaiShortDate(album.albumDate)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

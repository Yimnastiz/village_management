import Link from "next/link";
import { Images } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { formatThaiShortDate } from "@/lib/utils";

type ResidentGalleryPageProps = {
  searchParams?: Promise<{ q?: string; sort?: string }>;
};

export default async function ResidentGalleryPage({ searchParams }: ResidentGalleryPageProps) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/auth/login");

  const query = (searchParams ? await searchParams : {}) ?? {};
  const keyword = query.q?.trim() ?? "";
  const sort = query.sort === "oldest" ? "oldest" : "newest";

  const village = await prisma.village.findUnique({
    where: { id: membership.villageId },
    select: { id: true, name: true },
  });
  if (!village) redirect("/auth/login");

  const albums = await prisma.galleryAlbum.findMany({
    where: {
      villageId: village.id,
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
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          fileUrl: true,
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
    where: { villageId: village.id },
    select: { title: true },
    orderBy: [{ albumDate: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  const suggestionTitles = Array.from(new Set(titleSuggestions.map((item) => item.title))).slice(0, 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">แกลเลอรีภาพ</h1>
        <p className="mt-1 text-sm text-gray-500">ภาพกิจกรรมและบรรยากาศของ {village.name}</p>
      </div>

      <form className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input
            name="q"
            label="ค้นหาชื่ออัลบั้ม"
            placeholder="พิมพ์ชื่ออัลบั้ม"
            defaultValue={keyword}
            list="resident-gallery-title-suggestions"
          />
          <datalist id="resident-gallery-title-suggestions">
            {suggestionTitles.map((title) => (
              <option key={title} value={title} />
            ))}
          </datalist>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">เรียงตามวันที่อัลบั้ม</label>
            <select
              name="sort"
              defaultValue={sort}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="newest">ใหม่ไปเก่า</option>
              <option value="oldest">เก่าไปใหม่</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button type="submit" className="inline-flex rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
              ค้นหา
            </button>
            <Link href="/resident/gallery" className="inline-flex rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              ล้างตัวกรอง
            </Link>
          </div>
        </div>
      </form>

      {albums.length === 0 ? (
        <EmptyState
          icon={Images}
          title="ยังไม่มีอัลบั้มภาพ"
          description={keyword ? "ไม่พบอัลบั้มตามคำค้นนี้" : "เมื่อแอดมินเพิ่มอัลบั้มรูปแล้วจะแสดงที่นี่"}
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
                {album.coverUrl || album.items[0]?.fileUrl ? (
                  <img
                    src={album.coverUrl || album.items[0]?.fileUrl || ""}
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
                  <Badge variant={album.isPublic ? "success" : "info"}>
                    {album.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}
                  </Badge>
                  {album.allowResidentSubmissions && <Badge variant="warning">ขอเพิ่มรูปได้</Badge>}
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
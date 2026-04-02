import Link from "next/link";
import { BookmarkCheck, AlertCircle, Images, Download, ShieldCheck, PhoneCall, Newspaper, MapPin } from "lucide-react";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { NEWS_VISIBILITY_LABELS, ISSUE_STAGE_LABELS, VILLAGE_PLACE_CATEGORY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";

export const dynamic = "force-dynamic";

type SearchParams = { sort?: string; type?: string };

const TYPE_LABELS: Record<string, string> = {
  all: "ทั้งหมด",
  news: "ข่าว",
  issue: "ปัญหา",
  album: "แกลเลอรี",
  download: "เอกสาร",
  transparency: "ความโปร่งใส",
  contact: "ผู้ติดต่อ",
  place: "สถานที่",
};

export default async function SavedPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/auth/login");

  const { sort = "date_desc", type = "all" } = await searchParams;
  const orderDir = sort === "date_asc" ? "asc" : "desc";

  const savedItems = await prisma.savedItem.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: orderDir },
    select: {
      id: true,
      newsId: true, downloadId: true, issueId: true,
      galleryAlbumId: true, transparencyId: true, contactId: true, placeId: true,
      news: { select: { id: true, title: true, summary: true, visibility: true, villageId: true } },
      download: { select: { id: true, title: true, description: true, visibility: true, category: true, villageId: true } },
      issue: { select: { id: true, title: true, stage: true, category: true, villageId: true } },
      galleryAlbum: { select: { id: true, title: true, villageId: true } },
      transparencyRecord: { select: { id: true, title: true, category: true, visibility: true, villageId: true } },
      contact: { select: { id: true, name: true, role: true, phone: true, category: true, villageId: true } },
      place: { select: { id: true, name: true, address: true, category: true, villageId: true } },
    },
  });

  const filtered = savedItems.filter((item) => {
    const vid = item.news?.villageId ?? item.download?.villageId ?? item.issue?.villageId
      ?? item.galleryAlbum?.villageId ?? item.transparencyRecord?.villageId ?? item.contact?.villageId ?? item.place?.villageId;
    if (vid && vid !== membership.villageId) return false;
    if (type === "news") return !!item.newsId;
    if (type === "issue") return !!item.issueId;
    if (type === "album") return !!item.galleryAlbumId;
    if (type === "download") return !!item.downloadId;
    if (type === "transparency") return !!item.transparencyId;
    if (type === "contact") return !!item.contactId;
    if (type === "place") return !!item.placeId;
    return true;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">รายการที่บันทึก</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-wrap gap-1">
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <Link
              key={key}
              href={`/resident/saved?type=${key}&sort=${sort}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                type === key ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Link href={`/resident/saved?type=${type}&sort=date_desc`}
            className={`rounded-lg px-3 py-1 text-xs font-medium ${sort !== "date_asc" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            ล่าสุดก่อน
          </Link>
          <Link href={`/resident/saved?type=${type}&sort=date_asc`}
            className={`rounded-lg px-3 py-1 text-xs font-medium ${sort === "date_asc" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            เก่าก่อน
          </Link>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={BookmarkCheck} title="ยังไม่มีรายการที่บันทึก"
          description="กดไอคอนบันทึกจากหน้าต่างๆ เพื่อกลับมาดูได้ที่นี่" />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            if (item.news) return (
              <Link key={item.id} href={`/resident/news/${item.news.id}`}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-50">
                  <Newspaper className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 mb-0.5">ข่าว/ประกาศ</p>
                  <p className="font-medium text-gray-900 line-clamp-1">{item.news.title}</p>
                  {item.news.summary && <p className="text-sm text-gray-500 line-clamp-1">{item.news.summary}</p>}
                </div>
                <Badge variant="outline" className="shrink-0">{NEWS_VISIBILITY_LABELS[item.news.visibility ?? "PUBLIC"]}</Badge>
              </Link>
            );

            if (item.issue) return (
              <Link key={item.id} href={`/resident/issues/${item.issue.id}`}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-50">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 mb-0.5">ปัญหา</p>
                  <p className="font-medium text-gray-900 line-clamp-1">{item.issue.title}</p>
                </div>
                <Badge variant="outline" className="shrink-0">{ISSUE_STAGE_LABELS[item.issue.stage] ?? item.issue.stage}</Badge>
              </Link>
            );

            if (item.galleryAlbum) return (
              <Link key={item.id} href={`/resident/gallery/${item.galleryAlbum.id}`}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-50">
                  <Images className="h-4 w-4 text-purple-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 mb-0.5">อัลบั้มรูป</p>
                  <p className="font-medium text-gray-900 line-clamp-1">{item.galleryAlbum.title}</p>
                </div>
              </Link>
            );

            if (item.download) return (
              <Link key={item.id} href={`/resident/downloads/${item.download.id}`}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-50">
                  <Download className="h-4 w-4 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 mb-0.5">เอกสารดาวน์โหลด</p>
                  <p className="font-medium text-gray-900 line-clamp-1">{item.download.title}</p>
                  <p className="text-sm text-gray-500">{item.download.category || "ทั่วไป"}</p>
                </div>
                <Badge variant="outline" className="shrink-0">{NEWS_VISIBILITY_LABELS[item.download.visibility ?? "PUBLIC"]}</Badge>
              </Link>
            );

            if (item.transparencyRecord) return (
              <Link key={item.id} href={`/resident/transparency/${item.transparencyRecord.id}`}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-teal-50">
                  <ShieldCheck className="h-4 w-4 text-teal-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 mb-0.5">ความโปร่งใส</p>
                  <p className="font-medium text-gray-900 line-clamp-1">{item.transparencyRecord.title}</p>
                  {item.transparencyRecord.category && <p className="text-sm text-gray-500">{item.transparencyRecord.category}</p>}
                </div>
                <Badge variant="outline" className="shrink-0">{NEWS_VISIBILITY_LABELS[item.transparencyRecord.visibility ?? "PUBLIC"]}</Badge>
              </Link>
            );

            if (item.contact) return (
              <div key={item.id}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
                  <PhoneCall className="h-4 w-4 text-red-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 mb-0.5">ผู้ติดต่อ</p>
                  <p className="font-medium text-gray-900">{item.contact.name}</p>
                  {item.contact.role && <p className="text-sm text-gray-500">{item.contact.role}</p>}
                  {item.contact.phone && (
                    <a href={`tel:${item.contact.phone}`} className="text-sm font-medium text-green-700 hover:underline">
                      {item.contact.phone}
                    </a>
                  )}
                </div>
                {item.contact.category && <Badge variant="outline" className="shrink-0">{item.contact.category}</Badge>}
              </div>
            );

            if (item.place) return (
              <Link key={item.id} href={`/resident/places/${item.place.id}`}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 mb-0.5">สถานที่</p>
                  <p className="font-medium text-gray-900 line-clamp-1">{item.place.name}</p>
                  {item.place.address && <p className="text-sm text-gray-500 line-clamp-1">{item.place.address}</p>}
                </div>
                <Badge variant="outline" className="shrink-0">{VILLAGE_PLACE_CATEGORY_LABELS[item.place.category] ?? item.place.category}</Badge>
              </Link>
            );

            return null;
          })}
        </div>
      )}
    </div>
  );
}

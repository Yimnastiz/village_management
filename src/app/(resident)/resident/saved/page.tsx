import Link from "next/link";
import { BookmarkCheck, AlertCircle, Images, Download, ShieldCheck, PhoneCall, Newspaper, MapPin } from "lucide-react";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { ResidentFilterDropdown, ResidentPageToolbar } from "@/components/resident/resident-page-toolbar";
import { NEWS_VISIBILITY_LABELS, ISSUE_STAGE_LABELS, VILLAGE_PLACE_CATEGORY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string; sort?: string; type?: string };

type SavedCard =
  | { id: string; type: "news"; target: { id: string; title: string; summary: string | null; visibility: keyof typeof NEWS_VISIBILITY_LABELS }; searchable: Array<string | null> }
  | { id: string; type: "issue"; target: { id: string; title: string; stage: keyof typeof ISSUE_STAGE_LABELS }; searchable: Array<string | null> }
  | { id: string; type: "album"; target: { id: string; title: string }; searchable: Array<string | null> }
  | { id: string; type: "download"; target: { id: string; title: string; description: string | null; category: string | null; visibility: keyof typeof NEWS_VISIBILITY_LABELS }; searchable: Array<string | null> }
  | { id: string; type: "transparency"; target: { id: string; title: string; category: string | null; visibility: keyof typeof NEWS_VISIBILITY_LABELS }; searchable: Array<string | null> }
  | { id: string; type: "contact"; target: { id: string; name: string; role: string | null; phone: string | null; category: string | null }; searchable: Array<string | null> }
  | { id: string; type: "place"; target: { id: string; name: string; address: string | null; category: keyof typeof VILLAGE_PLACE_CATEGORY_LABELS }; searchable: Array<string | null> };

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
  if (!membership) redirect("/resident/dashboard");

  const { q = "", sort = "date_desc", type = "all" } = await searchParams;
  const keyword = q.trim();
  const orderDir = sort === "date_asc" ? "asc" : "desc";

  // Foreign keys on SavedItem intentionally use SET NULL. Remove only rows that
  // no longer reference any target; saves for temporarily unavailable content
  // remain intact so they can reappear after publish/access is restored.
  await prisma.savedItem.deleteMany({
    where: {
      userId: session.id,
      newsId: null,
      downloadId: null,
      issueId: null,
      galleryAlbumId: null,
      transparencyId: null,
      contactId: null,
      placeId: null,
    },
  });

  const savedItems = await prisma.savedItem.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: orderDir },
    select: {
      id: true,
      newsId: true, downloadId: true, issueId: true,
      galleryAlbumId: true, transparencyId: true, contactId: true, placeId: true,
      news: { select: { id: true, title: true, summary: true, visibility: true, villageId: true, stage: true } },
      download: { select: { id: true, title: true, description: true, visibility: true, category: true, villageId: true, stage: true } },
      issue: { select: { id: true, title: true, stage: true, category: true, villageId: true, reporterId: true, isPublic: true } },
      galleryAlbum: { select: { id: true, title: true, villageId: true, isPublic: true } },
      transparencyRecord: { select: { id: true, title: true, category: true, visibility: true, villageId: true, stage: true } },
      contact: { select: { id: true, name: true, role: true, phone: true, category: true, villageId: true, isPublic: true } },
      place: { select: { id: true, name: true, address: true, category: true, villageId: true, isPublic: true } },
    },
  });

  const isCurrentVillage = (villageId: string) => villageId === membership.villageId;
  const hasMatchingVisibility = (visibility: "PUBLIC" | "RESIDENT_ONLY") =>
    membership ? ["PUBLIC", "RESIDENT_ONLY"].includes(visibility) : visibility === "PUBLIC";

  // Every branch below mirrors its resident detail route. This deliberately
  // builds cards only after existence and access checks rather than filtering
  // raw SavedItem rows and returning null later while rendering.
  const visibleSavedItems: SavedCard[] = savedItems.flatMap((item): SavedCard[] => {
    if (item.news && isCurrentVillage(item.news.villageId) && item.news.stage === "PUBLISHED" && hasMatchingVisibility(item.news.visibility)) {
      return [{ id: item.id, type: "news" as const, target: item.news, searchable: [item.news.title, item.news.summary] }];
    }
    if (item.issue && isCurrentVillage(item.issue.villageId) && (item.issue.reporterId === session.id || item.issue.isPublic)) {
      return [{ id: item.id, type: "issue" as const, target: item.issue, searchable: [item.issue.title] }];
    }
    if (item.galleryAlbum && isCurrentVillage(item.galleryAlbum.villageId)) {
      return [{ id: item.id, type: "album" as const, target: item.galleryAlbum, searchable: [item.galleryAlbum.title] }];
    }
    if (item.download && isCurrentVillage(item.download.villageId) && item.download.stage === "PUBLISHED" && hasMatchingVisibility(item.download.visibility)) {
      return [{ id: item.id, type: "download" as const, target: item.download, searchable: [item.download.title, item.download.description] }];
    }
    if (item.transparencyRecord && isCurrentVillage(item.transparencyRecord.villageId) && item.transparencyRecord.stage === "PUBLISHED" && hasMatchingVisibility(item.transparencyRecord.visibility)) {
      return [{ id: item.id, type: "transparency" as const, target: item.transparencyRecord, searchable: [item.transparencyRecord.title, item.transparencyRecord.category] }];
    }
    if (item.contact && isCurrentVillage(item.contact.villageId)) {
      return [{ id: item.id, type: "contact" as const, target: item.contact, searchable: [item.contact.name, item.contact.role, item.contact.phone] }];
    }
    if (item.place && isCurrentVillage(item.place.villageId)) {
      return [{ id: item.id, type: "place" as const, target: item.place, searchable: [item.place.name, item.place.address] }];
    }
    return [];
  });

  const normalizedKeyword = keyword.toLocaleLowerCase("th-TH");
  const filtered = visibleSavedItems.filter((item) =>
    (type === "all" || item.type === type) &&
    (!keyword || item.searchable.some((value) => value?.toLocaleLowerCase("th-TH").includes(normalizedKeyword)))
  );

  const savedHref = (nextType = type, nextSort = sort) => {
    const params = new URLSearchParams();
    if (keyword) params.set("q", keyword);
    if (nextType !== "all") params.set("type", nextType);
    if (nextSort !== "date_desc") params.set("sort", nextSort);
    const query = params.toString();
    return query ? `/resident/saved?${query}` : "/resident/saved";
  };

  return (
    <div className="space-y-6">
      <ResidentPageToolbar
        namespace="resident-saved"
        registerHeader
        title="รายการที่บันทึกไว้"
        description="รวมรายการสำคัญที่คุณบันทึกไว้เพื่อกลับมาดูภายหลัง"
        search={{ keyword, placeholder: "ค้นหารายการที่บันทึก", label: "ค้นหารายการที่บันทึก" }}
        activeFilterCount={Number(type !== "all")}
        filters={<><ResidentFilterDropdown label="ประเภท" options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ label, href: savedHref(value), active: type === value }))} /><ResidentFilterDropdown label="เรียง" options={[{ label: "ล่าสุดก่อน", href: savedHref(type, "date_desc"), active: sort !== "date_asc" }, { label: "เก่าก่อน", href: savedHref(type, "date_asc"), active: sort === "date_asc" }]} />{type !== "all" ? <Link href={savedHref("all")} className="inline-flex h-9 items-center rounded-md px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500">ล้างตัวกรอง</Link> : null}</>}
      />

      {filtered.length === 0 ? (
        <EmptyState icon={BookmarkCheck} title="ยังไม่มีรายการที่บันทึก"
          description="กดไอคอนบันทึกจากหน้าต่างๆ เพื่อกลับมาดูได้ที่นี่" />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            if (item.type === "news") return (
              <Link key={item.id} href={`/resident/news/${item.target.id}`}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-50">
                  <Newspaper className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 mb-0.5">ข่าว/ประกาศ</p>
                  <p className="font-medium text-gray-900 line-clamp-1">{item.target.title}</p>
                  {item.target.summary && <p className="text-sm text-gray-500 line-clamp-1">{item.target.summary}</p>}
                </div>
                <Badge variant="outline" className="shrink-0">{NEWS_VISIBILITY_LABELS[item.target.visibility ?? "PUBLIC"]}</Badge>
              </Link>
            );

            if (item.type === "issue") return (
              <Link key={item.id} href={`/resident/issues/${item.target.id}`}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-50">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 mb-0.5">ปัญหา</p>
                  <p className="font-medium text-gray-900 line-clamp-1">{item.target.title}</p>
                </div>
                <Badge variant="outline" className="shrink-0">{ISSUE_STAGE_LABELS[item.target.stage] ?? item.target.stage}</Badge>
              </Link>
            );

            if (item.type === "album") return (
              <Link key={item.id} href={`/resident/gallery/${item.target.id}`}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-50">
                  <Images className="h-4 w-4 text-purple-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 mb-0.5">อัลบั้มรูป</p>
                  <p className="font-medium text-gray-900 line-clamp-1">{item.target.title}</p>
                </div>
              </Link>
            );

            if (item.type === "download") return (
              <Link key={item.id} href={`/resident/downloads/${item.target.id}`}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-50">
                  <Download className="h-4 w-4 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 mb-0.5">เอกสารดาวน์โหลด</p>
                  <p className="font-medium text-gray-900 line-clamp-1">{item.target.title}</p>
                  <p className="text-sm text-gray-500">{item.target.category || "ทั่วไป"}</p>
                </div>
                <Badge variant="outline" className="shrink-0">{NEWS_VISIBILITY_LABELS[item.target.visibility ?? "PUBLIC"]}</Badge>
              </Link>
            );

            if (item.type === "transparency") return (
              <Link key={item.id} href={`/resident/transparency/${item.target.id}`}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-teal-50">
                  <ShieldCheck className="h-4 w-4 text-teal-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 mb-0.5">ความโปร่งใส</p>
                  <p className="font-medium text-gray-900 line-clamp-1">{item.target.title}</p>
                  {item.target.category && <p className="text-sm text-gray-500">{item.target.category}</p>}
                </div>
                <Badge variant="outline" className="shrink-0">{NEWS_VISIBILITY_LABELS[item.target.visibility ?? "PUBLIC"]}</Badge>
              </Link>
            );

            if (item.type === "contact") return (
              <div key={item.id}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
                  <PhoneCall className="h-4 w-4 text-red-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 mb-0.5">ผู้ติดต่อ</p>
                  <p className="font-medium text-gray-900">{item.target.name}</p>
                  {item.target.role && <p className="text-sm text-gray-500">{item.target.role}</p>}
                  {item.target.phone && (
                    <a href={`tel:${item.target.phone}`} className="text-sm font-medium text-green-700 hover:underline">
                      {item.target.phone}
                    </a>
                  )}
                </div>
                {item.target.category && <Badge variant="outline" className="shrink-0">{item.target.category}</Badge>}
              </div>
            );

            if (item.type === "place") return (
              <Link key={item.id} href={`/resident/places/${item.target.id}`}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 mb-0.5">สถานที่</p>
                  <p className="font-medium text-gray-900 line-clamp-1">{item.target.name}</p>
                  {item.target.address && <p className="text-sm text-gray-500 line-clamp-1">{item.target.address}</p>}
                </div>
                <Badge variant="outline" className="shrink-0">{VILLAGE_PLACE_CATEGORY_LABELS[item.target.category] ?? item.target.category}</Badge>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

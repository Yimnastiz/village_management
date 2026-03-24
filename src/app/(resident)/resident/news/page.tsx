import Link from "next/link";
import { FilePlus2, Newspaper } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { NEWS_AUTHOR_SOURCE_LABELS, NEWS_VISIBILITY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";

interface PageProps {
  searchParams: Promise<{ sort?: string; source?: string; q?: string }>;
}

const ADMIN_MEMBERSHIP_ROLES = ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] as const;

export default async function ResidentNewsPage({ searchParams }: PageProps) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/auth/login");

  const query = await searchParams;
  const sort = query.sort === "oldest" ? "oldest" : "newest";
  const source = query.source === "admin" || query.source === "resident" ? query.source : "all";
  const keyword = query.q?.trim() ?? "";

  const orderBy =
    sort === "oldest"
      ? [{ isPinned: "desc" as const }, { publishedAt: "asc" as const }, { createdAt: "asc" as const }]
      : [{ isPinned: "desc" as const }, { publishedAt: "desc" as const }, { createdAt: "desc" as const }];

  const newsList = await prisma.news.findMany({
    where: {
      villageId: membership.villageId,
      stage: "PUBLISHED",
      visibility: { in: ["PUBLIC", "RESIDENT_ONLY"] },
      ...(keyword
        ? {
            title: {
              contains: keyword,
              mode: "insensitive" as const,
            },
          }
        : {}),
    },
    orderBy,
    select: {
      id: true,
      title: true,
      summary: true,
      visibility: true,
      isPinned: true,
      publishedAt: true,
      createdAt: true,
      authorId: true,
      author: {
        select: {
          memberships: {
            where: {
              villageId: membership.villageId,
              status: "ACTIVE",
            },
            select: { role: true },
          },
        },
      },
    },
    take: 100,
  });

  const filteredNewsList = newsList.filter((newsItem) => {
    if (source === "all") return true;
    const roles = newsItem.author?.memberships.map((membershipItem) => membershipItem.role) ?? [];
    const isAdminSource = roles.some((role) =>
      ADMIN_MEMBERSHIP_ROLES.includes(role as (typeof ADMIN_MEMBERSHIP_ROLES)[number])
    );
    if (source === "admin") return isAdminSource;
    return !isAdminSource;
  });

  const titleSuggestions = await prisma.news.findMany({
    where: {
      villageId: membership.villageId,
      stage: "PUBLISHED",
      visibility: { in: ["PUBLIC", "RESIDENT_ONLY"] },
    },
    select: { title: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  const suggestionTitles = Array.from(new Set(titleSuggestions.map((item) => item.title))).slice(0, 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">ข่าว/ประกาศ</h1>
        <div className="flex items-center gap-2">
          <Link href="/resident/news/requests">
            <Button size="sm" variant="outline">คำขอของฉัน</Button>
          </Link>
          <Link href="/resident/news/requests/new">
            <Button size="sm">
              <FilePlus2 className="h-4 w-4 mr-1" /> ขอเพิ่มข่าว
            </Button>
          </Link>
        </div>
      </div>

      <form className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input
            name="q"
            list="resident-news-title-suggestions"
            label="ค้นหาหัวข้อข่าว"
            placeholder="พิมพ์ชื่อข่าว"
            defaultValue={keyword}
          />
          <datalist id="resident-news-title-suggestions">
            {suggestionTitles.map((title) => (
              <option key={title} value={title} />
            ))}
          </datalist>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">ผู้สร้างข่าว</label>
            <select
              name="source"
              defaultValue={source}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="all">ทั้งหมด</option>
              <option value="resident">เฉพาะข่าวลูกบ้าน</option>
              <option value="admin">เฉพาะข่าวแอดมิน</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">เรียงตามวันที่</label>
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
            <Button type="submit" size="sm">ค้นหา</Button>
            <Link href="/resident/news">
              <Button type="button" variant="outline" size="sm">ล้างตัวกรอง</Button>
            </Link>
          </div>
        </div>
      </form>

      {filteredNewsList.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="ยังไม่มีข่าว"
          description="ข่าวที่เผยแพร่แล้วจะแสดงที่นี่"
        />
      ) : (
        <div className="space-y-4">
          {filteredNewsList.map((news) => (
            <Link
              key={news.id}
              href={`/resident/news/${news.id}`}
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {news.isPinned && (
                      <span className="text-[11px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                        ปักหมุด
                      </span>
                    )}
                    <Badge variant="outline">{NEWS_VISIBILITY_LABELS[news.visibility]}</Badge>
                    <Badge variant="outline">
                      {(() => {
                        if (!news.authorId) return NEWS_AUTHOR_SOURCE_LABELS.UNKNOWN;
                        const roles = news.author?.memberships.map(
                          (membershipItem: { role: string }) => membershipItem.role
                        ) ?? [];
                        const isAdminSource = roles.some((role: string) =>
                          ADMIN_MEMBERSHIP_ROLES.includes(role as (typeof ADMIN_MEMBERSHIP_ROLES)[number])
                        );
                        return isAdminSource ? NEWS_AUTHOR_SOURCE_LABELS.ADMIN : NEWS_AUTHOR_SOURCE_LABELS.RESIDENT;
                      })()}
                    </Badge>
                  </div>
                  <p className="font-medium text-gray-900 line-clamp-1">{news.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{news.summary || "-"}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {(news.publishedAt ?? news.createdAt).toLocaleDateString("th-TH")}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

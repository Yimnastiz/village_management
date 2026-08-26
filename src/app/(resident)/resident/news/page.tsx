import Link from "next/link";
import { Newspaper } from "lucide-react";
import { redirect } from "next/navigation";
import { NewsVisibility } from "@prisma/client";
import { EmptyState } from "@/components/ui/empty-state";
import { NewsMetadata } from "@/components/news/news-metadata";
import { prisma } from "@/lib/prisma";
import { getResidentVillageAccess, getSessionContextFromServerCookies } from "@/lib/access-control";
import { ResidentNewsToolbar } from "./resident-news-toolbar";
import { NewsCard } from "@/components/news/news-card";
import { formatNewsAuthor } from "@/lib/news-author";
import { residentContentVisibility } from "@/lib/resident-content-access";
import { newsDetailHref, type ResidentNewsContext } from "@/lib/resident-news-navigation";

interface PageProps {
  searchParams: Promise<{ sort?: string; source?: string; visibility?: string; q?: string }>;
}

const SOURCE_EMPTY_STATE: Record<"all" | "admin" | "resident", { title: string; description: string }> = {
  all: {
    title: "ยังไม่มีข่าว",
    description: "ข่าวที่เผยแพร่แล้วจะแสดงที่นี่",
  },
  admin: {
    title: "ยังไม่มีข่าวจากแอดมิน",
    description: "เมื่อแอดมินเผยแพร่ข่าว ข่าวจะแสดงที่นี่",
  },
  resident: {
    title: "ยังไม่มีข่าวจากลูกบ้าน",
    description: "เมื่อมีข่าวจากลูกบ้านที่เผยแพร่แล้ว ข่าวจะแสดงที่นี่",
  },
};

export default async function ResidentNewsPage({ searchParams }: PageProps) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = await getResidentVillageAccess(session);
  if (!membership) redirect("/resident/dashboard");

  const query = await searchParams;
  const sort = query.sort === "oldest" ? "oldest" : "newest";
  const source = query.source === "admin" || query.source === "resident" ? query.source : "all";
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
  const visibilityWhereClause: NewsVisibility | { in: NewsVisibility[] } =
    !membership.hasResidentAccess
      ? NewsVisibility.PUBLIC
      : selectedVisibilities.length === 1
      ? selectedVisibilities[0]
      : { in: ["PUBLIC", "RESIDENT_ONLY"] };

  const keyword = query.q?.trim() ?? "";
  const newsContext: ResidentNewsContext = { from: "news-list", q: keyword || undefined, sort, source, visibility: [...selectedVisibilities].sort().join(",") || undefined };

  const orderBy =
    sort === "oldest"
      ? [{ isPinned: "desc" as const }, { publishedAt: "asc" as const }, { createdAt: "asc" as const }]
      : [{ isPinned: "desc" as const }, { publishedAt: "desc" as const }, { createdAt: "desc" as const }];

  const now = new Date();

  const [newsList, superAdminAnnouncements] = await Promise.all([
    prisma.news.findMany({
      where: {
        villageId: membership.villageId,
        stage: "PUBLISHED",
        visibility: visibilityWhereClause,
        ...(keyword ? { OR: [
          { title: { contains: keyword, mode: "insensitive" as const } },
          { author: { is: { name: { contains: keyword, mode: "insensitive" as const } } } },
        ] } : {}),
      },
      orderBy,
      select: {
        id: true,
        title: true,
        summary: true,
        coverUrl: true,
        imageUrls: true,
        visibility: true,
        isPinned: true,
        publishedAt: true,
        createdAt: true,
        authorId: true,
        author: {
          select: {
            name: true, systemRole: true, memberships: {
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
    }),
    prisma.notification.findMany({
      where: {
        userId: session.id,
        type: "SYSTEM",
        status: { in: ["UNREAD", "READ"] },
        metadata: {
          path: ["source"],
          equals: "SUPERADMIN_BROADCAST",
        },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        title: true,
        body: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ]);

  const visibleSuperAdminAnnouncements = superAdminAnnouncements.filter((item) => {
    const metadata = item.metadata as Record<string, unknown> | null;
    const expiresAtRaw = typeof metadata?.expiresAt === "string" ? metadata.expiresAt : null;
    if (!expiresAtRaw) {
      return true;
    }

    const expiresAt = new Date(expiresAtRaw);
    return expiresAt > now;
  });

  const filteredNewsList = newsList.filter((newsItem) => {
    if (source === "all") return true;
    const roles = newsItem.author?.memberships.map((membershipItem) => membershipItem.role) ?? [];
    const isAdminSource = roles.some((role) => ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"].includes(role));
    return source === "admin" ? isAdminSource : !isAdminSource;
  });

  const titleSuggestions = await prisma.news.findMany({
    where: {
      villageId: membership.villageId,
      stage: "PUBLISHED",
      visibility: residentContentVisibility(membership.hasResidentAccess),
    },
    select: { title: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  const suggestionTitles = Array.from(new Set(titleSuggestions.map((item) => item.title))).slice(0, 20);

  return (
    <div className="space-y-6">
      <ResidentNewsToolbar
        keyword={keyword}
        source={source}
        selectedVisibilities={selectedVisibilities}
        sort={sort}
      suggestionTitles={suggestionTitles}
      canSubmit={membership.hasResidentAccess}
      hasResidentAccess={membership.hasResidentAccess}
      />

      {source !== "resident" && visibleSuperAdminAnnouncements.length > 0 ? (
        <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 sm:p-5">
          <p className="text-sm font-semibold text-cyan-900">ประกาศจาก Super Admin</p>
          <div className="mt-3 space-y-2">
            {visibleSuperAdminAnnouncements.map((announcement) => (
              <Link
                key={announcement.id}
                href={`/resident/notifications/${announcement.id}`}
                className="block rounded-lg border border-cyan-100 bg-white px-3 py-2 hover:bg-cyan-50"
              >
                <p className="text-sm font-medium text-gray-900">{announcement.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">{announcement.body || "-"}</p>
                <p className="mt-1 text-xs text-gray-400">{announcement.createdAt.toLocaleString("th-TH")}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {filteredNewsList.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title={SOURCE_EMPTY_STATE[source].title}
          description={SOURCE_EMPTY_STATE[source].description}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredNewsList.map((news) => (
            <NewsCard
              key={news.id}
              href={newsDetailHref(news.id, newsContext)}
              title={news.title}
              summary={news.summary}
              imageUrl={news.coverUrl || (Array.isArray(news.imageUrls) ? String(news.imageUrls[0] ?? "") : null)}
              isPinned={news.isPinned}
              metadata={<NewsMetadata visibility={news.visibility} isPinned={news.isPinned} showPinned={false} showStage={false} />}
              meta={`${(news.publishedAt ?? news.createdAt).toLocaleDateString("th-TH")} · ${formatNewsAuthor(news.author?.name, news.author?.systemRole, news.author?.memberships[0]?.role)}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

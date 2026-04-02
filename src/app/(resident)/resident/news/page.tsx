import Link from "next/link";
import { Newspaper } from "lucide-react";
import { redirect } from "next/navigation";
import { NewsVisibility } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { NEWS_AUTHOR_SOURCE_LABELS, NEWS_VISIBILITY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { ResidentNewsToolbar } from "./resident-news-toolbar";

interface PageProps {
  searchParams: Promise<{ sort?: string; source?: string; visibility?: string; q?: string }>;
}

const ADMIN_MEMBERSHIP_ROLES = ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] as const;
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

  const membership = getResidentMembership(session);
  if (!membership) redirect("/auth/login");

  const query = await searchParams;
  const sort = query.sort === "oldest" ? "oldest" : "newest";
  const source = query.source === "admin" || query.source === "resident" ? query.source : "all";
  const visibilityParam = (query.visibility ?? "").trim();
  const selectedVisibilities = Array.from(
    new Set(
      visibilityParam
        .split(",")
        .map((value) => value.trim())
        .filter((value): value is "PUBLIC" | "RESIDENT_ONLY" =>
          value === "PUBLIC" || value === "RESIDENT_ONLY"
        )
    )
  );

  const visibilityWhereClause: NewsVisibility | { in: NewsVisibility[] } =
    selectedVisibilities.length === 1
      ? selectedVisibilities[0]
      : { in: ["PUBLIC", "RESIDENT_ONLY"] };

  const keyword = query.q?.trim() ?? "";

  const orderBy =
    sort === "oldest"
      ? [{ isPinned: "desc" as const }, { publishedAt: "asc" as const }, { createdAt: "asc" as const }]
      : [{ isPinned: "desc" as const }, { publishedAt: "desc" as const }, { createdAt: "desc" as const }];

  const newsList = await prisma.news.findMany({
    where: {
      villageId: membership.villageId,
      stage: "PUBLISHED",
      visibility: visibilityWhereClause,
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
    return source === "admin" ? isAdminSource : !isAdminSource;
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
      <ResidentNewsToolbar
        keyword={keyword}
        source={source}
        selectedVisibilities={selectedVisibilities}
        sort={sort}
        suggestionTitles={suggestionTitles}
      />

      {filteredNewsList.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title={SOURCE_EMPTY_STATE[source].title}
          description={SOURCE_EMPTY_STATE[source].description}
        />
      ) : (
        <div className="space-y-4">
          {filteredNewsList.map((news) => (
            <Link
              key={news.id}
              href={`/resident/news/${news.id}`}
              className="block bg-white rounded-xl border border-gray-200 p-4 sm:p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {news.isPinned && (
                      <span className="text-[11px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                        ปักหมุด
                      </span>
                    )}
                    <Badge
                      variant="outline"
                      className={
                        news.visibility === "PUBLIC"
                          ? "border-sky-200 bg-sky-50 text-sky-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }
                    >
                      {NEWS_VISIBILITY_LABELS[news.visibility]}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        (() => {
                          if (!news.authorId) {
                            return "border-gray-300 bg-gray-50 text-gray-700";
                          }

                          const roles = news.author?.memberships.map(
                            (membershipItem: { role: string }) => membershipItem.role
                          ) ?? [];

                          const isAdminSource = roles.some((role: string) =>
                            ADMIN_MEMBERSHIP_ROLES.includes(role as (typeof ADMIN_MEMBERSHIP_ROLES)[number])
                          );

                          return isAdminSource
                            ? "border-violet-200 bg-violet-50 text-violet-700"
                            : "border-amber-200 bg-amber-50 text-amber-700";
                        })()
                      }
                    >
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
                  <p className="text-xs text-gray-400 mt-1 sm:hidden">
                    {(news.publishedAt ?? news.createdAt).toLocaleDateString("th-TH")}
                  </p>
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap hidden sm:block">
                  {(news.publishedAt ?? news.createdAt).toLocaleDateString("th-TH")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

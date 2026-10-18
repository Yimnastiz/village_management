import { Newspaper } from "lucide-react";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { NewsCard } from "@/components/news/news-card";
import { getNewsImageCount } from "@/lib/news-image-count";
import { NewsMetadata } from "@/components/news/news-metadata";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { AdminNewsToolbar } from "./admin-news-toolbar";
import { getPendingNewsSubmissionCount } from "@/lib/news-submission.server";
import { getActiveSystemBroadcastTickerItems } from "@/lib/system-broadcast-ticker.server";
import { SystemBroadcastTicker } from "@/components/notifications/system-broadcast-ticker";
import { RESIDENT_ACTOR_USER_SELECT, residentActorDisplay } from "@/lib/resident-actor-display";
import { EmptyState } from "@/components/ui/empty-state";

type PageProps = {
  searchParams?: Promise<{ q?: string; stage?: string; visibility?: string; sort?: string }>;
};

export default async function AdminNewsPage({ searchParams }: PageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, villageId: session.activeVillageId!, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const keyword = params.q?.trim() ?? "";
  const activeStage = params.stage ?? "ALL";
  const activeVisibility = params.visibility ?? "ALL";
  const activeSort = params.sort ?? "newest";

  const where: Prisma.NewsWhereInput = { villageId: membership.villageId };
  if (keyword) {
    where.OR = [
      { title: { contains: keyword, mode: "insensitive" } },
      { summary: { contains: keyword, mode: "insensitive" } },
      { content: { contains: keyword, mode: "insensitive" } },
    ];
  }
  if (activeStage !== "ALL") {
    where.stage = activeStage as "DRAFT" | "PUBLISHED" | "ARCHIVED";
  }
  if (activeVisibility !== "ALL") {
    where.visibility = activeVisibility as "PUBLIC" | "RESIDENT_ONLY";
  }

  const orderBy =
    activeSort === "oldest"
      ? [{ isPinned: "desc" as const }, { createdAt: "asc" as const }]
      : [{ isPinned: "desc" as const }, { createdAt: "desc" as const }];

  const [newsList, pendingNewsRequestCount, tickerItems] = await Promise.all([prisma.news.findMany({
    where,
    orderBy,
    select: {
      id: true,
      title: true,
      summary: true,
      coverUrl: true,
      imageUrls: true,
      stage: true,
      visibility: true,
      isPinned: true,
      authorId: true,
      publishedAt: true,
      createdAt: true,
      author: {
        select: { ...RESIDENT_ACTOR_USER_SELECT, memberships: { where: { villageId: membership.villageId, status: "ACTIVE" }, select: { role: true } } },
      },
    },
  }), getPendingNewsSubmissionCount(membership.villageId), getActiveSystemBroadcastTickerItems(session.id, "admin")]);

  const suggestionTitles = Array.from(new Set(newsList.map((news) => news.title))).slice(0, 12);

  return (
    <div data-admin-compact-top className="space-y-3">
      <AdminNewsToolbar key={`${keyword}|${activeStage}|${activeVisibility}|${activeSort}`} keyword={keyword} stage={activeStage} visibility={activeVisibility} sort={activeSort} suggestionTitles={suggestionTitles} pendingCount={pendingNewsRequestCount} />
      <SystemBroadcastTicker items={tickerItems} />

      {newsList.length === 0 ? (
        <EmptyState variant="admin" icon={Newspaper} title={keyword || activeStage !== "ALL" || activeVisibility !== "ALL" ? "ไม่พบข่าวที่ตรงกับเงื่อนไข" : "ยังไม่มีข่าวในระบบ"} description={keyword || activeStage !== "ALL" || activeVisibility !== "ALL" ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง" : "เมื่อเพิ่มข่าว รายการจะแสดงที่นี่"} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {newsList.map((news) => (
            <NewsCard
              key={news.id}
              href={`/admin/news/${news.id}`}
              title={news.title}
              summary={news.summary}
              imageUrl={news.coverUrl || (Array.isArray(news.imageUrls) ? String(news.imageUrls[0] ?? "") : null)}
              imageCount={getNewsImageCount(news.imageUrls, news.coverUrl)}
              isPinned={news.isPinned}
              metadata={<NewsMetadata stage={news.stage} visibility={news.visibility} isPinned={news.isPinned} showPinned={false} />}
              meta={`${(news.publishedAt ?? news.createdAt).toLocaleDateString("th-TH")} · ${news.author ? residentActorDisplay(news.author, { villageId: membership.villageId }).label : "ไม่ระบุ"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

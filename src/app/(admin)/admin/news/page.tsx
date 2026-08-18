import Link from "next/link";
import { Newspaper } from "lucide-react";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { NewsCard } from "@/components/news/news-card";
import { NEWS_STAGE_LABELS, NEWS_VISIBILITY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { formatNewsAuthor } from "@/lib/news-author";
import { AdminNewsToolbar } from "./admin-news-toolbar";
import { getPendingNewsSubmissionCount } from "@/lib/news-submission.server";

type PageProps = {
  searchParams?: Promise<{ q?: string; stage?: string; visibility?: string; sort?: string }>;
};

const stageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  DRAFT: "warning",
  PUBLISHED: "success",
  ARCHIVED: "default",
};

export default async function AdminNewsPage({ searchParams }: PageProps) {
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

  const [newsList, pendingNewsRequestCount] = await Promise.all([prisma.news.findMany({
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
        select: { name: true, systemRole: true, memberships: { where: { villageId: membership.villageId, status: "ACTIVE" }, select: { role: true } } },
      },
    },
  }), getPendingNewsSubmissionCount(membership.villageId)]);

  const now = new Date();
  const superAdminAnnouncements = await prisma.notification.findMany({
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
    take: 20,
    select: {
      id: true,
      title: true,
      body: true,
      metadata: true,
      createdAt: true,
    },
  });

  const visibleSuperAdminAnnouncements = superAdminAnnouncements.filter((item) => {
    const metadata = item.metadata as Record<string, unknown> | null;
    const expiresAtRaw = typeof metadata?.expiresAt === "string" ? metadata.expiresAt : null;
    if (!expiresAtRaw) {
      return true;
    }
    return new Date(expiresAtRaw) > now;
  });

  const suggestionTitles = Array.from(new Set(newsList.map((news) => news.title))).slice(0, 12);

  return (
    <div className="space-y-6">
      <AdminNewsToolbar key={`${keyword}|${activeStage}|${activeVisibility}|${activeSort}`} keyword={keyword} stage={activeStage} visibility={activeVisibility} sort={activeSort} suggestionTitles={suggestionTitles} pendingCount={pendingNewsRequestCount} />

      {visibleSuperAdminAnnouncements.length > 0 ? (
        <section className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-cyan-900">ประกาศจาก Super Admin</h2>
          <div className="mt-3 space-y-2">
            {visibleSuperAdminAnnouncements.map((announcement) => (
              <Link
                key={announcement.id}
                href={`/admin/notifications/${announcement.id}`}
                className="block rounded-lg border border-cyan-100 bg-white px-3 py-2 hover:bg-cyan-50"
              >
                <p className="text-sm font-medium text-gray-900">{announcement.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">{announcement.body || "-"}</p>
                <p className="mt-1 text-xs text-gray-400">{announcement.createdAt.toLocaleString("th-TH")}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {newsList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Newspaper className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">ยังไม่มีข่าวในระบบ</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {newsList.map((news) => (
            <NewsCard
              key={news.id}
              href={`/admin/news/${news.id}`}
              title={news.title}
              summary={news.summary}
              imageUrl={news.coverUrl || (Array.isArray(news.imageUrls) ? String(news.imageUrls[0] ?? "") : null)}
              isPinned={news.isPinned}
              badge={<><Badge variant={stageVariant[news.stage] ?? "default"}>{NEWS_STAGE_LABELS[news.stage]}</Badge><Badge variant="outline">{NEWS_VISIBILITY_LABELS[news.visibility]}</Badge></>}
              meta={`${(news.publishedAt ?? news.createdAt).toLocaleDateString("th-TH")} · ${formatNewsAuthor(news.author?.name, news.author?.systemRole, news.author?.memberships[0]?.role)}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { Newspaper, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { NewsCard } from "@/components/news/news-card";
import { NEWS_STAGE_LABELS, NEWS_VISIBILITY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

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

  const newsList = await prisma.news.findMany({
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
        select: { name: true },
      },
    },
  });

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

  function buildNewsHref(next: { q?: string; stage?: string; visibility?: string; sort?: string }) {
    const query = new URLSearchParams();
    const q = next.q?.trim() ?? "";
    const stage = next.stage ?? "ALL";
    const visibility = next.visibility ?? "ALL";
    const sort = next.sort ?? "newest";

    if (q) query.set("q", q);
    if (stage !== "ALL") query.set("stage", stage);
    if (visibility !== "ALL") query.set("visibility", visibility);
    if (sort !== "newest") query.set("sort", sort);

    const queryString = query.toString();
    return queryString ? `/admin/news?${queryString}` : "/admin/news";
  }

  return (
    <div className="space-y-6">
      <AdminListToolbar
        title="จัดการข่าว"
        description="ค้นหาและกรองข่าวตามสถานะและการมองเห็น"
        searchAction="/admin/news"
        keyword={keyword}
        searchPlaceholder="ค้นหาชื่อข่าวหรือสรุปข่าว"
        hiddenInputs={{ stage: activeStage === "ALL" ? "" : activeStage, visibility: activeVisibility === "ALL" ? "" : activeVisibility, sort: activeSort === "newest" ? "" : activeSort }}
        suggestionTitles={suggestionTitles}
        groups={[
          {
            label: "สถานะ",
            options: [
              { label: "ทั้งหมด", href: buildNewsHref({ q: keyword, stage: "ALL", visibility: activeVisibility, sort: activeSort }), active: activeStage === "ALL" },
              { label: "ร่าง", href: buildNewsHref({ q: keyword, stage: "DRAFT", visibility: activeVisibility, sort: activeSort }), active: activeStage === "DRAFT" },
              { label: "เผยแพร่", href: buildNewsHref({ q: keyword, stage: "PUBLISHED", visibility: activeVisibility, sort: activeSort }), active: activeStage === "PUBLISHED" },
              { label: "เก็บถาวร", href: buildNewsHref({ q: keyword, stage: "ARCHIVED", visibility: activeVisibility, sort: activeSort }), active: activeStage === "ARCHIVED" },
            ],
          },
          {
            label: "การมองเห็น",
            options: [
              { label: "ทั้งหมด", href: buildNewsHref({ q: keyword, stage: activeStage, visibility: "ALL", sort: activeSort }), active: activeVisibility === "ALL" },
              { label: "สาธารณะ", href: buildNewsHref({ q: keyword, stage: activeStage, visibility: "PUBLIC", sort: activeSort }), active: activeVisibility === "PUBLIC" },
              { label: "ลูกบ้าน", href: buildNewsHref({ q: keyword, stage: activeStage, visibility: "RESIDENT_ONLY", sort: activeSort }), active: activeVisibility === "RESIDENT_ONLY" },
            ],
          },
          {
            label: "เรียง",
            options: [
              { label: "ล่าสุดก่อน", href: buildNewsHref({ q: keyword, stage: activeStage, visibility: activeVisibility, sort: "newest" }), active: activeSort === "newest" },
              { label: "เก่าก่อน", href: buildNewsHref({ q: keyword, stage: activeStage, visibility: activeVisibility, sort: "oldest" }), active: activeSort === "oldest" },
            ],
          },
        ]}
        actions={
          <>
            <Link href="/admin/news/requests">
              <Button size="sm" variant="outline">คำขอข่าวจากลูกบ้าน</Button>
            </Link>
            <Link href="/admin/news/new">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> เพิ่มข่าว
              </Button>
            </Link>
          </>
        }
      />

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
              meta={`${(news.publishedAt ?? news.createdAt).toLocaleDateString("th-TH")} · ${news.author?.name || "ไม่ระบุผู้สร้าง"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

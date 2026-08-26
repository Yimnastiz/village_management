import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { NEWS_AUTHOR_SOURCE_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getResidentVillageAccess, getSessionContextFromServerCookies } from "@/lib/access-control";
import { ImageCarousel } from "@/components/ui/image-carousel";
import { NewsSaveButton } from "./news-save-button";
import { formatNewsAuthor } from "@/lib/news-author";
import { NewsMetadata } from "@/components/news/news-metadata";
import { PageBackLink } from "@/components/ui/page-back-link";
import { newsListHref, newsRequestEditHref, readResidentNewsContext, requestListHref } from "@/lib/resident-news-navigation";

interface PageProps {
  params: Promise<{ newsId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ResidentNewsDetailPage({ params, searchParams }: PageProps) {
  const { newsId } = await params;
  const context = readResidentNewsContext(await searchParams);
  const fromPublished = context?.from === "requests-published";
  const backHref = fromPublished ? requestListHref(context) : newsListHref(context);
  const adminRoles = ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] as const;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = await getResidentVillageAccess(session);
  if (!membership) redirect("/resident/dashboard");

  const [news, savedItem] = await Promise.all([
    prisma.news.findFirst({
      where: {
        id: newsId,
        villageId: membership.villageId,
        stage: "PUBLISHED",
        visibility: membership.hasResidentAccess ? { in: ["PUBLIC", "RESIDENT_ONLY"] } : "PUBLIC",
      },
      include: {
        author: {
          select: {
            name: true, systemRole: true,
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
    }),
    prisma.savedItem.findFirst({
      where: { userId: session.id, newsId },
      select: { id: true },
    }),
  ]);

  if (!news) notFound();

  const authorRoles = news.author?.memberships.map((membershipItem) => membershipItem.role) ?? [];
  const isAdminAuthor = authorRoles.some((role) => adminRoles.includes(role as (typeof adminRoles)[number]));
  const sourceLabel = !news.authorId
    ? NEWS_AUTHOR_SOURCE_LABELS.UNKNOWN
    : isAdminAuthor
      ? NEWS_AUTHOR_SOURCE_LABELS.ADMIN
      : NEWS_AUTHOR_SOURCE_LABELS.RESIDENT;
  const canRequestEdit = Boolean(news.authorId) && news.authorId === session.id;

  const imageUrls = Array.isArray(news.imageUrls)
    ? news.imageUrls.map((value) => String(value)).filter((url) => url.length > 0)
    : [];
  if (news.coverUrl && imageUrls.includes(news.coverUrl)) imageUrls.splice(0, 0, ...imageUrls.splice(imageUrls.indexOf(news.coverUrl), 1));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-1 sm:px-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageBackLink href={backHref} label={fromPublished ? "กลับข่าวที่เผยแพร่" : "กลับข่าวสาร"} />
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {canRequestEdit && (
            <Link href={newsRequestEditHref(newsId, context)} className="text-sm text-green-700 hover:text-green-800">
              ขอแก้ไขข่าวของฉัน
            </Link>
          )}
          {membership.hasResidentAccess ? <NewsSaveButton newsId={newsId} initialSaved={Boolean(savedItem)} /> : null}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{news.title}</h1>
          <NewsMetadata className="mt-3 text-sm" visibility={news.visibility} isPinned={news.isPinned} showStage={false} />
          <p className="mt-2 text-sm text-gray-400">
            {sourceLabel} · {(news.publishedAt ?? news.createdAt).toLocaleDateString("th-TH")}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            ผู้สร้างข่าว: {formatNewsAuthor(news.author?.name, news.author?.systemRole, news.author?.memberships[0]?.role)}
          </p>
          {news.summary && <p className="text-sm text-gray-600 mt-3">{news.summary}</p>}
        </div>

        {imageUrls.length > 0 && (
          <div className="mb-6">
            <ImageCarousel images={imageUrls} altPrefix={news.title} thumbnailBehavior="select" />
          </div>
        )}

        <div className="border-t border-gray-100 pt-6">
          <p className="break-words whitespace-pre-wrap text-gray-700 leading-7">{news.content}</p>
        </div>
      </div>
    </div>
  );
}

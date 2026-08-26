import { FileClock, Newspaper } from "lucide-react";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { EmptyState } from "@/components/ui/empty-state";
import { PageBackLink } from "@/components/ui/page-back-link";
import { RequestViewTabs } from "@/components/ui/request-view-tabs";
import { ResidentPageToolbar } from "@/components/resident/resident-page-toolbar";
import { NEWS_SUBMISSION_STATUS_LABELS, NEWS_SUBMISSION_TYPE_LABELS } from "@/lib/constants";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { newsDetailHref, requestDetailHref } from "@/lib/resident-news-navigation";
import { ResidentNewsRequestCard, ResidentPublishedNewsCard } from "./resident-news-request-cards";

type Tab = "pending" | "history" | "published";

function isDeleteRequestPayload(payload: Prisma.JsonValue): boolean {
  return Boolean(payload && typeof payload === "object" && !Array.isArray(payload) && payload.isDeleteRequest === true);
}

function requestTitle(payload: Prisma.JsonValue): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "คำขอข่าว";
  const title = payload.title;
  return typeof title === "string" && title.trim() ? title : "คำขอข่าว";
}

function requestImageSource(payload: Prisma.JsonValue) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return { imageUrls: payload.imageUrls, coverUrl: payload.coverUrl };
}

function tabHref(tab: Tab) {
  if (tab === "history") return "/resident/news/requests?tab=history";
  if (tab === "published") return "/resident/news/requests?tab=published";
  return "/resident/news/requests";
}

export default async function ResidentNewsRequestsPage({ searchParams }: { searchParams?: Promise<{ tab?: string; q?: string }> }) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");

  const query = await searchParams;
  const tab: Tab = query?.tab === "history" || query?.tab === "published" ? query.tab : "pending";
  const keyword = tab === "published" ? query?.q?.trim() ?? "" : "";
  const listContext = { from: `requests-${tab}` as "requests-pending" | "requests-history" | "requests-published", q: keyword || undefined };
  const requestWhere: Prisma.NewsSubmissionWhereInput = {
    requesterId: session.id,
    villageId: membership.villageId,
    ...(tab === "pending" ? { status: "PENDING" } : { status: { in: ["APPROVED", "REJECTED"] } }),
  };

  const [pendingCount, requests, publishedNews] = await Promise.all([
    prisma.newsSubmission.count({ where: { requesterId: session.id, villageId: membership.villageId, status: "PENDING" } }),
    tab === "published" ? Promise.resolve([]) : prisma.newsSubmission.findMany({
      where: requestWhere,
      orderBy: tab === "pending" ? [{ createdAt: "desc" }] : [{ reviewedAt: "desc" }, { createdAt: "desc" }],
      include: { targetNews: { select: { id: true, title: true } } },
    }),
    tab !== "published" ? Promise.resolve([]) : prisma.news.findMany({
      where: {
        authorId: session.id,
        villageId: membership.villageId,
        stage: "PUBLISHED",
        ...(keyword ? { OR: [
          { title: { contains: keyword, mode: "insensitive" as const } },
          { summary: { contains: keyword, mode: "insensitive" as const } },
        ] } : {}),
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      include: { submissions: { where: { status: "PENDING" }, select: { id: true, payload: true } } },
    }),
  ]);

  const tabs = <RequestViewTabs label="มุมมองคำขอข่าว" className="w-fit max-w-full flex-nowrap overflow-x-auto" tabs={[
    { href: tabHref("pending"), label: "รอพิจารณา", count: pendingCount, active: tab === "pending" },
    { href: tabHref("history"), label: "ประวัติ", active: tab === "history" },
    { href: tabHref("published"), label: "ข่าวที่เผยแพร่", active: tab === "published" },
  ]} />;

  return <div className="space-y-4 sm:space-y-5">
    <ResidentPageToolbar
      namespace="resident-news-requests"
      title="คำขอข่าว"
      hideHeading
      search={tab === "published" ? { keyword, placeholder: "ค้นหาข่าวที่เผยแพร่", label: "ค้นหาข่าวที่เผยแพร่" } : undefined}
      actions={<div className="flex min-w-0 flex-wrap items-center gap-2"><PageBackLink href="/resident/news" label="กลับข่าวสาร" />{tabs}</div>}
    />

    {tab !== "published" ? <section className="space-y-3" aria-label={tab === "pending" ? "คำขอข่าวที่รอพิจารณา" : "ประวัติคำขอข่าว"}>
      {requests.length === 0 ? <EmptyState icon={FileClock} title={tab === "pending" ? "ไม่มีคำขอที่รอพิจารณา" : "ยังไม่มีประวัติคำขอ"} /> : requests.map((request) => {
        const isDeleteRequest = isDeleteRequestPayload(request.payload);
        return <ResidentNewsRequestCard key={request.id} href={requestDetailHref(request.id, listContext)} status={request.status} statusLabel={NEWS_SUBMISSION_STATUS_LABELS[request.status]} typeLabel={isDeleteRequest ? "คำขอลบข่าว" : NEWS_SUBMISSION_TYPE_LABELS[request.type]} title={requestTitle(request.payload)} submittedAt={request.createdAt.toLocaleDateString("th-TH")} reviewedAt={tab === "history" && request.reviewedAt ? request.reviewedAt.toLocaleDateString("th-TH") : undefined} targetTitle={request.targetNews?.title} source={requestImageSource(request.payload)} note={request.reviewNote} />;
      })}
    </section> : <section className="space-y-3" aria-label="ข่าวที่เผยแพร่ของฉัน">
      {publishedNews.length === 0 ? <EmptyState icon={Newspaper} title={keyword ? "ไม่พบข่าวที่ตรงกับการค้นหา" : "ยังไม่มีข่าวที่เผยแพร่"} /> : publishedNews.map((news) => {
        const pendingRequest = news.submissions[0] ?? null;
        return <ResidentPublishedNewsCard key={news.id} href={newsDetailHref(news.id, listContext)} title={news.title} summary={news.summary} publishedAt={news.publishedAt ? news.publishedAt.toLocaleDateString("th-TH") : "-"} visibility={news.visibility} source={news} hasPendingRequest={Boolean(pendingRequest)} />;
      })}
    </section>}
  </div>;
}

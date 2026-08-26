import Link from "next/link";
import { FileClock, Newspaper } from "lucide-react";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageBackLink } from "@/components/ui/page-back-link";
import { RequestViewTabs } from "@/components/ui/request-view-tabs";
import { ResidentPageToolbar } from "@/components/resident/resident-page-toolbar";
import { NEWS_SUBMISSION_STATUS_LABELS, NEWS_SUBMISSION_TYPE_LABELS } from "@/lib/constants";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { NewsDeleteRequestButton } from "./news-delete-request-button";
import { newsDetailHref, newRequestHref, requestDetailHref } from "@/lib/resident-news-navigation";

type Tab = "pending" | "history" | "published";

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING: "warning", APPROVED: "success", REJECTED: "danger",
};

function isDeleteRequestPayload(payload: Prisma.JsonValue): boolean {
  return Boolean(payload && typeof payload === "object" && !Array.isArray(payload) && payload.isDeleteRequest === true);
}

function requestTitle(payload: Prisma.JsonValue): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "คำขอข่าว";
  const title = payload.title;
  return typeof title === "string" && title.trim() ? title : "คำขอข่าว";
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
        return <article key={request.id} className="rounded-xl border border-gray-200 bg-white transition hover:border-gray-300 hover:shadow-sm">
          <Link href={requestDetailHref(request.id, listContext)} className="block p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-600 sm:p-5" aria-label={`ดูรายละเอียดคำขอข่าว: ${requestTitle(request.payload)}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant={statusVariant[request.status] ?? "default"}>{NEWS_SUBMISSION_STATUS_LABELS[request.status]}</Badge><span className="text-sm text-gray-500">{isDeleteRequest ? "คำขอลบข่าว" : NEWS_SUBMISSION_TYPE_LABELS[request.type]}</span></div><p className="truncate font-semibold text-gray-900">{requestTitle(request.payload)}</p>{request.targetNews?.title ? <p className="mt-1 truncate text-sm text-gray-500">อ้างอิงข่าว: {request.targetNews.title}</p> : null}{tab === "history" && request.reviewedAt ? <p className="mt-2 text-sm text-gray-600">พิจารณาเมื่อ {request.reviewedAt.toLocaleDateString("th-TH")}</p> : null}{request.reviewNote ? <p className="mt-1 line-clamp-2 text-sm text-gray-700">{request.status === "REJECTED" ? "เหตุผล: " : "หมายเหตุ: "}{request.reviewNote}</p> : null}</div>
              <p className="shrink-0 text-xs text-gray-400">ส่งเมื่อ {request.createdAt.toLocaleDateString("th-TH")}</p>
            </div>
          </Link>
        </article>;
      })}
    </section> : <section className="space-y-3" aria-label="ข่าวที่เผยแพร่ของฉัน">
      {publishedNews.length === 0 ? <EmptyState icon={Newspaper} title={keyword ? "ไม่พบข่าวที่ตรงกับการค้นหา" : "ยังไม่มีข่าวที่เผยแพร่"} /> : publishedNews.map((news) => {
        const pendingRequest = news.submissions[0] ?? null;
        const isPendingDelete = pendingRequest ? isDeleteRequestPayload(pendingRequest.payload) : false;
        return <article key={news.id} className="rounded-xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 hover:shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link href={newsDetailHref(news.id, listContext)} className="min-w-0 flex-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"><p className="truncate text-base font-semibold leading-tight text-gray-900">{news.title}</p>{news.summary ? <p className="mt-1 line-clamp-2 text-sm text-gray-600">{news.summary}</p> : null}<p className="mt-1.5 text-xs text-gray-400">เผยแพร่เมื่อ {news.publishedAt ? news.publishedAt.toLocaleDateString("th-TH") : "-"}</p></Link>
            <div className="flex shrink-0 flex-wrap items-center gap-2">{pendingRequest ? <Link href={requestDetailHref(pendingRequest.id, listContext)} className="inline-flex h-9 items-center rounded-md border border-amber-200 bg-amber-50 px-3 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500">{isPendingDelete ? "มีคำขอลบรอพิจารณา" : "มีคำขอรอพิจารณา"}</Link> : <><Link href={newRequestHref(listContext, news.id)} className="inline-flex h-9 items-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500">ขอแก้ไข</Link><NewsDeleteRequestButton newsId={news.id} className="h-9 px-3" /></>}</div>
          </div>
        </article>;
      })}
    </section>}
  </div>;
}

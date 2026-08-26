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
import { createNewsDeleteRequestAction } from "./actions";

type Tab = "pending" | "history";

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" };

function isDeleteRequestPayload(payload: Prisma.JsonValue): boolean {
  return Boolean(payload && typeof payload === "object" && !Array.isArray(payload) && payload.isDeleteRequest === true);
}

function requestTitle(payload: Prisma.JsonValue): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "คำขอข่าว";
  const title = payload.title;
  return typeof title === "string" && title.trim() ? title : "คำขอข่าว";
}

export default async function ResidentNewsRequestsPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");

  const tab: Tab = (await searchParams)?.tab === "history" ? "history" : "pending";
  const requestWhere: Prisma.NewsSubmissionWhereInput = {
    requesterId: session.id,
    villageId: membership.villageId,
    ...(tab === "pending" ? { status: "PENDING" } : { status: { in: ["APPROVED", "REJECTED"] } }),
  };
  const [requests, pendingCount, myNews] = await Promise.all([
    prisma.newsSubmission.findMany({
      where: requestWhere,
      orderBy: tab === "pending" ? [{ createdAt: "desc" }] : [{ reviewedAt: "desc" }, { createdAt: "desc" }],
      include: { targetNews: { select: { id: true, title: true } } },
    }),
    prisma.newsSubmission.count({ where: { requesterId: session.id, villageId: membership.villageId, status: "PENDING" } }),
    prisma.news.findMany({
      where: { authorId: session.id, villageId: membership.villageId, stage: "PUBLISHED" },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      include: { submissions: { where: { status: "PENDING" }, select: { id: true, type: true, payload: true } } },
    }),
  ]);

  const tabs = <RequestViewTabs label="มุมมองคำขอข่าว" tabs={[
    { href: "/resident/news/requests", label: "รอพิจารณา", count: pendingCount, active: tab === "pending" },
    { href: "/resident/news/requests?tab=history", label: "ประวัติ", active: tab === "history" },
  ]} />;

  return <div className="space-y-10">
    <ResidentPageToolbar namespace="resident-news-requests" title="คำขอข่าว" hideHeading actions={<div className="flex w-full flex-wrap items-center justify-between gap-3"><PageBackLink href="/resident/news" label="กลับข่าวสาร" />{tabs}</div>} />

    <section className="space-y-4" aria-label={tab === "pending" ? "คำขอข่าวที่รอพิจารณา" : "ประวัติคำขอข่าว"}>
      {requests.length === 0 ? <EmptyState icon={FileClock} title={tab === "pending" ? "ไม่มีคำขอที่รอพิจารณา" : "ยังไม่มีประวัติคำขอ"} /> : <div className="space-y-3">
        {requests.map((request) => {
          const isDeleteRequest = isDeleteRequestPayload(request.payload);
          return <article key={request.id} className="rounded-xl border border-gray-200 bg-white transition hover:border-gray-300 hover:shadow-sm"><Link href={`/resident/news/requests/${request.id}`} className="block p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-600 sm:p-5" aria-label={`ดูรายละเอียดคำขอข่าว: ${requestTitle(request.payload)}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant={statusVariant[request.status] ?? "default"}>{NEWS_SUBMISSION_STATUS_LABELS[request.status]}</Badge><Badge variant="outline">{isDeleteRequest ? "ขอลบข่าว" : NEWS_SUBMISSION_TYPE_LABELS[request.type]}</Badge></div><p className="truncate font-semibold text-gray-900">{requestTitle(request.payload)}</p><p className="mt-1 truncate text-sm text-gray-500">{request.targetNews?.title ? `อ้างอิงข่าว: ${request.targetNews.title}` : "คำขอเพิ่มข่าวใหม่"}</p>{tab === "history" && request.reviewedAt ? <p className="mt-2 text-sm text-gray-600">พิจารณาเมื่อ {request.reviewedAt.toLocaleDateString("th-TH")}</p> : null}{request.reviewNote ? <p className="mt-1 line-clamp-2 text-sm text-gray-700">{request.status === "REJECTED" ? "เหตุผล: " : "หมายเหตุ: "}{request.reviewNote}</p> : null}</div><p className="shrink-0 text-xs text-gray-400">ส่งเมื่อ {request.createdAt.toLocaleDateString("th-TH")}</p></div></Link></article>;
        })}
      </div>}
    </section>

    <section className="space-y-6 border-t border-gray-200 pt-6" aria-labelledby="published-news-heading">
      <div><h2 id="published-news-heading" className="flex items-center gap-2 text-xl font-bold text-gray-900"><Newspaper className="h-5 w-5 text-green-600" />ข่าวสารที่เผยแพร่แล้วของฉัน</h2><p className="mt-1 text-sm text-gray-500">รายการข่าวสารที่คุณเป็นผู้เขียนและเผยแพร่อยู่ในระบบ คุณสามารถยื่นคำขอแก้ไขหรือคำขอลบข่าวได้</p></div>
      {myNews.length === 0 ? <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">ยังไม่มีข่าวสารที่คุณเผยแพร่</div> : <div className="space-y-3">
        {myNews.map((news) => {
          const pendingSubmissions = news.submissions;
          const hasPendingRequest = pendingSubmissions.length > 0;
          const isPendingDelete = pendingSubmissions[0] ? isDeleteRequestPayload(pendingSubmissions[0].payload) : false;
          return <article key={news.id} className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-base font-semibold leading-tight text-gray-900">{news.title}</p><p className="mt-1.5 text-xs text-gray-400">เผยแพร่เมื่อ: {news.publishedAt ? news.publishedAt.toLocaleDateString("th-TH") : "-"}</p></div><div className="flex shrink-0 flex-wrap items-center gap-2">{hasPendingRequest ? <Badge variant="warning">{isPendingDelete ? "อยู่ระหว่างรออนุมัติลบข่าว" : "อยู่ระหว่างรออนุมัติแก้ไขข่าว"}</Badge> : <><Link href={`/resident/news/requests/new?newsId=${news.id}`}><button type="button" className="inline-flex h-9 items-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500">ขอแก้ไขข่าว</button></Link><form action={async () => { "use server"; await createNewsDeleteRequestAction(news.id); }}><button type="submit" className="inline-flex h-9 items-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-red-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500">ขอลบข่าว</button></form></>}</div></div></article>;
        })}
      </div>}
    </section>
  </div>;
}

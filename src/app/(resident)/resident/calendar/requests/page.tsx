import { FileClock } from "lucide-react";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { EmptyState } from "@/components/ui/empty-state";
import { PageBackLink } from "@/components/ui/page-back-link";
import { RequestViewTabs } from "@/components/ui/request-view-tabs";
import { ResidentPageToolbar } from "@/components/resident/resident-page-toolbar";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { resolveApprovedSubmissionEvent } from "@/lib/calendar-submission-event";
import { prisma } from "@/lib/prisma";
import { ResidentCalendarRequestCard, ResidentPublishedCalendarCard } from "./resident-calendar-request-cards";
import { ResidentEventRequestModal } from "../resident-event-request-modal";

type Tab = "pending" | "history" | "published";

const statusLabels: Record<string, string> = { PENDING: "รอพิจารณา", APPROVED: "อนุมัติแล้ว", REJECTED: "ไม่อนุมัติ" };
const typeLabels: Record<string, string> = { CREATE: "คำขอเพิ่มกิจกรรม", EDIT: "คำขอแก้ไขกิจกรรม", DELETE: "คำขอลบกิจกรรม" };

function tabHref(tab: Tab) {
  if (tab === "history") return "/resident/calendar/requests?tab=history";
  if (tab === "published") return "/resident/calendar/requests?tab=published";
  return "/resident/calendar/requests";
}

function formatEventSchedule(startsAt: Date, endsAt: Date | null) {
  const options = { timeZone: "Asia/Bangkok" };
  const date = startsAt.toLocaleDateString("th-TH", { ...options, day: "numeric", month: "short", year: "numeric" });
  const startTime = startsAt.toLocaleTimeString("th-TH", { ...options, hour: "2-digit", minute: "2-digit" });
  if (!endsAt) return `${date} · ${startTime}`;
  const endDate = endsAt.toLocaleDateString("en-CA", options);
  const startDate = startsAt.toLocaleDateString("en-CA", options);
  if (startDate === endDate) return `${date} · ${startTime}–${endsAt.toLocaleTimeString("th-TH", { ...options, hour: "2-digit", minute: "2-digit" })}`;
  return `${date} · ${startTime} – ${endsAt.toLocaleDateString("th-TH", { ...options, day: "numeric", month: "short", year: "numeric" })} ${endsAt.toLocaleTimeString("th-TH", { ...options, hour: "2-digit", minute: "2-digit" })}`;
}

export default async function ResidentCalendarRequestsPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");

  const query = await searchParams;
  const tab: Tab = query?.tab === "history" || query?.tab === "published" ? query.tab : "pending";
  const requestWhere: Prisma.VillageEventSubmissionWhereInput = {
    requesterId: session.id,
    villageId: membership.villageId,
    ...(tab === "pending" ? { status: "PENDING" } : { status: { in: ["APPROVED", "REJECTED"] } }),
  };

  const [pendingCount, requests, approvedCreateSubmissions] = await Promise.all([
    prisma.villageEventSubmission.count({ where: { requesterId: session.id, villageId: membership.villageId, status: "PENDING" } }),
    tab === "published" ? Promise.resolve([]) : prisma.villageEventSubmission.findMany({
      where: requestWhere,
      select: { id: true, status: true, type: true, isPublic: true, title: true, startsAt: true, endsAt: true, location: true, reviewNote: true, reviewedAt: true, createdAt: true },
      orderBy: tab === "pending" ? [{ createdAt: "desc" }] : [{ reviewedAt: "desc" }, { createdAt: "desc" }],
    }),
    tab !== "published" ? Promise.resolve([]) : prisma.villageEventSubmission.findMany({
      where: { requesterId: session.id, villageId: membership.villageId, type: "CREATE", status: "APPROVED" },
      select: { eventId: true, villageId: true, title: true, description: true, location: true, startsAt: true, endsAt: true, isPublic: true },
      orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const publishedEvents = tab === "published"
    ? Array.from(new Map((await Promise.all(approvedCreateSubmissions.map(resolveApprovedSubmissionEvent))).filter((event): event is NonNullable<typeof event> => Boolean(event)).map((event) => [event.id, event])).values())
    : [];
  const pendingEventIds = publishedEvents.map((event) => event.id);
  const pendingChangeRequests = pendingEventIds.length
    ? await prisma.villageEventSubmission.findMany({ where: { requesterId: session.id, villageId: membership.villageId, eventId: { in: pendingEventIds }, type: { in: ["EDIT", "DELETE"] }, status: "PENDING" }, select: { eventId: true } })
    : [];
  const pendingChangeEventIds = new Set(pendingChangeRequests.flatMap((request) => request.eventId ? [request.eventId] : []));

  const tabs = <RequestViewTabs label="มุมมองคำขอกิจกรรม" className="w-fit max-w-full flex-nowrap overflow-x-auto" tabs={[
    { href: tabHref("pending"), label: "รอพิจารณา", count: pendingCount, active: tab === "pending" },
    { href: tabHref("history"), label: "ประวัติ", active: tab === "history" },
    { href: tabHref("published"), label: "กิจกรรมที่เผยแพร่", active: tab === "published" },
  ]} />;

  return <div className="space-y-4 sm:space-y-5">
    <ResidentPageToolbar
      namespace="resident-calendar-requests"
      title="คำขอกิจกรรม"
      hideHeading
      actions={<div className="flex min-w-0 flex-wrap items-center gap-2"><PageBackLink href="/resident/calendar" label="กลับปฏิทิน" />{tabs}<ResidentEventRequestModal triggerLabel="ส่งคำขอ" /></div>}
    />

    {tab !== "published" ? <section className="space-y-3" aria-label={tab === "pending" ? "คำขอที่รอพิจารณา" : "ประวัติคำขอ"}>
      {requests.length === 0 ? <EmptyState icon={FileClock} title={tab === "pending" ? "ไม่มีคำขอที่รอพิจารณา" : "ยังไม่มีประวัติคำขอ"} /> : requests.map((request) => <ResidentCalendarRequestCard
        key={request.id}
        href={`/resident/calendar/requests/${request.id}`}
        status={request.status}
        statusLabel={statusLabels[request.status] ?? request.status}
        typeLabel={typeLabels[request.type] ?? request.type}
        title={request.title}
        schedule={formatEventSchedule(request.startsAt, request.endsAt)}
        location={request.location}
        isPublic={request.isPublic}
        submittedAt={request.createdAt.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}
        reviewedAt={tab === "history" && request.reviewedAt ? request.reviewedAt.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }) : undefined}
        note={request.reviewNote}
      />)}
    </section> : <section className="space-y-3" aria-label="กิจกรรมที่เผยแพร่จากคำขอของฉัน">
      {publishedEvents.length === 0 ? <EmptyState icon={FileClock} title="ยังไม่มีกิจกรรมที่เผยแพร่จากคำขอของคุณ" /> : publishedEvents.map((event) => <ResidentPublishedCalendarCard
        key={event.id}
        href={`/resident/calendar/${event.id}`}
        title={event.title}
        schedule={formatEventSchedule(event.startsAt, event.endsAt)}
        location={event.location}
        isPublic={event.isPublic}
        hasPendingRequest={pendingChangeEventIds.has(event.id)}
      />)}
    </section>}
  </div>;
}

import Link from "next/link";
import { Inbox } from "lucide-react";
import { Prisma } from "@prisma/client";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { NewsFilterChip } from "@/components/news/news-toolbar";
import type { ToolbarGroup } from "@/components/ui/admin-list-toolbar";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { prisma } from "@/lib/prisma";
import { parseCalendarMonth, toDateKey, toMonthKey } from "@/lib/calendar-month";
import { SuperAdminCalendarGrid } from "./superadmin-calendar-grid";
import { SuperAdminCalendarEventActions } from "./superadmin-calendar-event-actions";

type PageProps = { params: Promise<{ villageId: string }>; searchParams?: Promise<{ q?: string; visibility?: string; month?: string; date?: string }> };

export default async function SuperAdminVillageCalendarPage({ params, searchParams }: PageProps) {
  const { villageId } = await params;
  const query = (searchParams ? await searchParams : {}) ?? {};
  const village = await prisma.village.findUniqueOrThrow({ where: { id: villageId }, select: { name: true } });
  const keyword = query.q?.trim() ?? "";
  const visibility = query.visibility === "PUBLIC" || query.visibility === "RESIDENT_ONLY" ? query.visibility : "ALL";
  const { year, monthIndex, yearStart, yearEnd } = parseCalendarMonth(query.month);
  const monthStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const nextMonthStart = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);
  const where: Prisma.VillageEventWhereInput = { villageId, startsAt: { gte: monthStart, lt: nextMonthStart } };
  if (visibility === "PUBLIC") where.isPublic = true;
  if (visibility === "RESIDENT_ONLY") where.isPublic = false;
  if (keyword) where.OR = [{ title: { contains: keyword, mode: "insensitive" } }, { location: { contains: keyword, mode: "insensitive" } }, { description: { contains: keyword, mode: "insensitive" } }];
  const [events, pendingRequestCount] = await Promise.all([
    prisma.villageEvent.findMany({ where, orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }], select: { id: true, title: true, description: true, location: true, startsAt: true, endsAt: true, isPublic: true, createdAt: true, updatedAt: true, createdBy: { select: { name: true } } }),
    prisma.villageEventSubmission.count({ where: { villageId, status: "PENDING" } }),
  ]);
  const creationAudits = events.length ? await prisma.auditLog.findMany({ where: { villageId, resource: "VillageEvent", resourceId: { in: events.map((event) => event.id) }, action: "CREATE" }, select: { resourceId: true, metadata: true } }) : [];
  const superAdminCreatedIds = new Set(creationAudits.filter((audit) => (audit.metadata as { actorRole?: string } | null)?.actorRole === "SUPERADMIN").map((audit) => audit.resourceId));
  const selectedDateKey = query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : null;
  const base = `/superadmin/villages/${villageId}/calendar`;
  const href = (next: { q?: string; visibility?: string; month?: string; date?: string }) => { const values = new URLSearchParams(); if (next.q?.trim()) values.set("q", next.q.trim()); if (next.visibility && next.visibility !== "ALL") values.set("visibility", next.visibility); if (next.month) values.set("month", next.month); if (next.date) values.set("date", next.date); return values.size ? `${base}?${values}` : base; };
  const filterGroups: ToolbarGroup[] = [{ label: "การมองเห็น", options: [{ label: "ทั้งหมด", href: href({ q: keyword, month: toMonthKey(monthStart) }), active: visibility === "ALL", isDefault: true }, { label: "สาธารณะ", href: href({ q: keyword, visibility: "PUBLIC", month: toMonthKey(monthStart) }), active: visibility === "PUBLIC" }, { label: "เฉพาะลูกบ้าน", href: href({ q: keyword, visibility: "RESIDENT_ONLY", month: toMonthKey(monthStart) }), active: visibility === "RESIDENT_ONLY" }] }];
  const serializedEvents = events.map((event) => ({ id: event.id, title: event.title, description: event.description, location: event.location, startsAt: event.startsAt.toISOString(), endsAt: event.endsAt?.toISOString() ?? null, isPublic: event.isPublic, createdAt: event.createdAt.toISOString(), updatedAt: event.updatedAt.toISOString(), createdByName: event.createdBy?.name ?? null, createdBySuperAdmin: superAdminCreatedIds.has(event.id) }));

  return <div className="space-y-5">
    <SuperAdminPageHeaderRegistration priority={1} context={{ title: "ปฏิทิน", description: `จัดการกิจกรรมและกำหนดการของ ${village.name} เพื่อการสนับสนุนงานหมู่บ้าน` }} />
    <CalendarToolbar hideHeading namespace="superadmin-village-calendar" title="ปฏิทิน" description="" currentYear={year} currentMonth={monthIndex + 1} yearStart={yearStart} yearEnd={yearEnd} todayMonthKey={toMonthKey(new Date())} search={{ keyword, placeholder: "ค้นหาชื่อกิจกรรม สถานที่ หรือรายละเอียด", suggestions: [...new Set(events.map((event) => event.title))].slice(0, 12) }} actions={<><Link href={`${base}/requests`} className="inline-flex h-11 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700"><Inbox className="mr-1.5 h-4 w-4" />คำขอกิจกรรม{pendingRequestCount ? ` (${pendingRequestCount})` : ""}</Link><SuperAdminCalendarEventActions villageId={villageId} /></>} filters={<><span className="text-xs font-semibold text-gray-500">การมองเห็น</span><NewsFilterChip href={href({ q: keyword, month: toMonthKey(monthStart) })} active={visibility === "ALL"}>ทั้งหมด</NewsFilterChip><NewsFilterChip href={href({ q: keyword, visibility: "PUBLIC", month: toMonthKey(monthStart) })} active={visibility === "PUBLIC"}>สาธารณะ</NewsFilterChip><NewsFilterChip href={href({ q: keyword, visibility: "RESIDENT_ONLY", month: toMonthKey(monthStart) })} active={visibility === "RESIDENT_ONLY"}>เฉพาะลูกบ้าน</NewsFilterChip></>} adminFilterGroups={filterGroups} />
    <SuperAdminCalendarGrid key={`${toMonthKey(monthStart)}-${selectedDateKey ?? "none"}`} villageId={villageId} year={year} monthIndex={monthIndex} todayKey={toDateKey(new Date())} initialDate={selectedDateKey} events={serializedEvents} />
  </div>;
}

import Link from "next/link";
import { Inbox, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { NewsFilterChip } from "@/components/news/news-toolbar";
import type { ToolbarGroup } from "@/components/ui/admin-list-toolbar";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { parseCalendarMonth, toDateKey, toMonthKey } from "@/lib/calendar-month";
import { AdminCalendarGrid } from "./admin-calendar-grid";

type PageProps = { searchParams?: Promise<{ q?: string; visibility?: string; month?: string; date?: string }> };

export default async function AdminCalendarPage({ searchParams }: PageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");
  const membership = await prisma.villageMembership.findFirst({ where: { userId: session.id, villageId: session.activeVillageId!, status: "ACTIVE" }, select: { villageId: true } });
  if (!membership) redirect("/auth/login");

  const keyword = params.q?.trim() ?? "";
  const activeVisibility = params.visibility === "PUBLIC" || params.visibility === "RESIDENT_ONLY" ? params.visibility : "ALL";
  const { year, monthIndex, yearStart, yearEnd } = parseCalendarMonth(params.month);
  const monthStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const nextMonthStart = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);
  const where: Prisma.VillageEventWhereInput = { villageId: membership.villageId, startsAt: { gte: monthStart, lt: nextMonthStart } };
  if (activeVisibility === "PUBLIC") where.isPublic = true;
  if (activeVisibility === "RESIDENT_ONLY") where.isPublic = false;
  if (keyword) where.OR = [{ title: { contains: keyword, mode: "insensitive" } }, { location: { contains: keyword, mode: "insensitive" } }, { description: { contains: keyword, mode: "insensitive" } }];

  const [events, appointments, pendingRequestCount] = await Promise.all([
    prisma.villageEvent.findMany({ where, orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }], select: { id: true, title: true, location: true, startsAt: true, endsAt: true, isPublic: true } }),
    prisma.appointment.findMany({ where: { villageId: membership.villageId, stage: { notIn: ["CANCELLED", "REJECTED"] }, scheduledAt: { gte: monthStart, lt: nextMonthStart } }, select: { id: true, title: true, scheduledAt: true, user: { select: { name: true } } }, orderBy: [{ scheduledAt: "asc" }] }),
    prisma.villageEventSubmission.count({ where: { villageId: membership.villageId, status: "PENDING" } }),
  ]);

  const buildCalendarHref = (next: { q?: string; visibility?: string; month?: string; date?: string }) => {
    const query = new URLSearchParams();
    const q = next.q?.trim() ?? "";
    const visibility = next.visibility ?? "ALL";
    if (q) query.set("q", q);
    if (visibility !== "ALL") query.set("visibility", visibility);
    if (next.month) query.set("month", next.month);
    if (next.date) query.set("date", next.date);
    const queryString = query.toString();
    return queryString ? `/admin/calendar?${queryString}` : "/admin/calendar";
  };
  const month = toMonthKey(monthStart);
  const filterGroups: ToolbarGroup[] = [{ label: "การมองเห็น", options: [
    { label: "ทั้งหมด", href: buildCalendarHref({ q: keyword, visibility: "ALL", month }), active: activeVisibility === "ALL", isDefault: true },
    { label: "สาธารณะ", href: buildCalendarHref({ q: keyword, visibility: "PUBLIC", month }), active: activeVisibility === "PUBLIC" },
    { label: "ลูกบ้าน", href: buildCalendarHref({ q: keyword, visibility: "RESIDENT_ONLY", month }), active: activeVisibility === "RESIDENT_ONLY" },
  ] }];
  const selectedDateKey = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) && params.date.startsWith(`${year}-${String(monthIndex + 1).padStart(2, "0")}-`) ? params.date : null;
  const suggestions = Array.from(new Set(events.map((event) => event.title))).slice(0, 12);

  return <div data-admin-compact-top className="space-y-6">
    <CalendarToolbar namespace="admin-calendar" title="ปฏิทิน" description="เพิ่ม แก้ไข และลบกิจกรรมของหมู่บ้าน" currentYear={year} currentMonth={monthIndex + 1} yearStart={yearStart} yearEnd={yearEnd} todayMonthKey={toMonthKey(new Date())} search={{ keyword, placeholder: "ค้นหาชื่อกิจกรรม สถานที่ หรือรายละเอียด", suggestions }} actions={<><Link href="/admin/calendar/requests" aria-label="คำขอกิจกรรม"><Button size="sm" variant="outline" className="h-11 px-2 sm:px-3"><Inbox className="h-4 w-4" /><span className="hidden sm:ml-1.5 sm:inline">คำขอกิจกรรม</span>{pendingRequestCount > 0 ? <span className="ml-1.5">({pendingRequestCount})</span> : null}</Button></Link><Link href="/admin/calendar/new"><Button size="sm" className="h-11 px-2 sm:px-3"><Plus className="h-4 w-4" /><span className="ml-1 hidden min-[360px]:inline">เพิ่มกิจกรรม</span></Button></Link></>} filters={<><span className="text-xs font-semibold text-gray-500">การมองเห็น</span><NewsFilterChip href={buildCalendarHref({ q: keyword, visibility: "ALL", month })} active={activeVisibility === "ALL"}>ทั้งหมด</NewsFilterChip><NewsFilterChip href={buildCalendarHref({ q: keyword, visibility: "PUBLIC", month })} active={activeVisibility === "PUBLIC"}>สาธารณะ</NewsFilterChip><NewsFilterChip href={buildCalendarHref({ q: keyword, visibility: "RESIDENT_ONLY", month })} active={activeVisibility === "RESIDENT_ONLY"}>ลูกบ้าน</NewsFilterChip><NewsFilterChip href={buildCalendarHref({ month })} active={false}>ล้างตัวกรอง</NewsFilterChip></>} adminFilterGroups={filterGroups} />
    <AdminCalendarGrid key={`${month}-${selectedDateKey ?? "none"}`} year={year} monthIndex={monthIndex} todayKey={toDateKey(new Date())} initialDate={selectedDateKey} searchKeyword={keyword} events={events.map((event) => ({ ...event, startsAt: event.startsAt.toISOString(), endsAt: event.endsAt?.toISOString() ?? null }))} appointments={appointments.filter((apt) => apt.scheduledAt).map((apt) => ({ id: apt.id, title: apt.title, scheduledAt: apt.scheduledAt!.toISOString(), userName: apt.user.name }))} />
  </div>;
}

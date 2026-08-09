import Link from "next/link";
import { FilePlus2, ListChecks } from "lucide-react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { getResidentVillageAccess, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { getVillageCalendarEvents } from "@/features/public-village/server/public-village-data";
import { parseCalendarMonth, toDateKey, toMonthKey } from "@/lib/calendar-month";
import { ResidentCalendarGrid } from "./resident-calendar-grid";

type Props = { searchParams?: Promise<{ month?: string }> };
export default async function ResidentVillageCalendarPage({ searchParams }: Props) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  const membership = await getResidentVillageAccess(session);
  if (!membership) redirect("/resident/dashboard");
  const village = await prisma.village.findUnique({ where: { id: membership.villageId }, select: { id: true, name: true } });
  if (!village) redirect("/auth/login");
  const { year, monthIndex, yearStart, yearEnd } = parseCalendarMonth(params.month);
  const start = new Date(year, monthIndex, 1), end = new Date(year, monthIndex + 1, 1);
  const [events, appointments] = await Promise.all([
    getVillageCalendarEvents({ villageId: village.id, startsAt: start, endsBefore: end, publicOnly: !membership.hasResidentAccess }),
    membership.hasResidentAccess ? prisma.appointment.findMany({ where: { villageId: village.id, userId: session.id, stage: { notIn: ["CANCELLED", "REJECTED"] }, OR: [{ scheduledAt: { gte: start, lt: end } }, { slot: { date: { gte: start, lt: end } } }] }, select: { id: true, title: true, stage: true, scheduledAt: true, slot: { select: { date: true, startTime: true, endTime: true } } } }) : [],
  ]);
  return <div className="space-y-6">
    <CalendarToolbar namespace="resident-calendar" residentCompact title="ปฏิทิน" description={`ดูกิจกรรมทั้งหมดของ ${village.name}`} currentYear={year} currentMonth={monthIndex + 1} yearStart={yearStart} yearEnd={yearEnd} todayMonthKey={toMonthKey(new Date())} actions={membership.hasResidentAccess ? <><Link href="/resident/calendar/requests"><Button size="sm" variant="outline" className="h-10 px-2 sm:px-3"><ListChecks className="h-4 w-4" /><span className="hidden sm:ml-1.5 sm:inline">คำขอของฉัน</span></Button></Link><Link href="/resident/calendar/requests/new"><Button size="sm" className="h-10 px-2 sm:px-3"><FilePlus2 className="h-4 w-4" /><span className="ml-1 hidden min-[390px]:inline">ขอเพิ่มกิจกรรม</span></Button></Link></> : undefined} />
    <ResidentCalendarGrid year={year} monthIndex={monthIndex} todayKey={toDateKey(new Date())} events={events.map(event => ({ id: event.id, title: event.title, startsAt: event.startsAt.toISOString(), endsAt: event.endsAt?.toISOString() ?? null, location: event.location, isPublic: event.isPublic }))} appointments={appointments.map(item => ({ id: item.id, title: item.title, stage: item.stage, date: toDateKey(item.scheduledAt ?? item.slot!.date), startTime: item.slot?.startTime ?? null, endTime: item.slot?.endTime ?? null }))} />
  </div>;
}

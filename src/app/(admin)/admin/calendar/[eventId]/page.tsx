import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { formatCalendarPerson } from "@/lib/calendar-person";
import { canHeadmanEditCalendarEvent } from "@/lib/calendar-event-policy";
import { RESIDENT_ACTOR_USER_SELECT, residentActorDisplay } from "@/lib/resident-actor-display";
import { DeleteVillageEventButton } from "./delete-button";
import { PageBackLink } from "@/components/ui/page-back-link";

interface PageProps {
  params: Promise<{ eventId: string }>;
}

export default async function VillageEventDetailPage({ params }: PageProps) {
  const { eventId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, villageId: session.activeVillageId!, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const event = await prisma.villageEvent.findFirst({
    where: { id: eventId, villageId: membership.villageId },
    include: {
      createdBy: {
        select: {
          ...RESIDENT_ACTOR_USER_SELECT,
          memberships: {
            where: { villageId: membership.villageId, status: "ACTIVE" },
            select: { role: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!event) notFound();
  const canEdit = canHeadmanEditCalendarEvent(event.createdById, session.id);
  const isResidentOwned = Boolean(event.createdById && event.createdById !== session.id);
  const isResidentCreator = event.createdBy?.accountKind === "RESIDENT_HOUSE";
  const creatorLabel = isResidentCreator
    ? residentActorDisplay(event.createdBy, { villageId: membership.villageId }).label
    : formatCalendarPerson(event.createdBy);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6">
      <PageBackLink href="/admin/calendar" label="กลับปฏิทิน" />
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {canEdit ? <Link href={`/admin/calendar/${event.id}/edit`}>
            <Button variant="outline" className="w-full sm:w-auto">แก้ไข</Button>
          </Link> : null}
          <DeleteVillageEventButton eventId={event.id} isResidentOwned={isResidentOwned} />
      </div>

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Badge variant={event.isPublic ? "success" : "info"}>
            {event.isPublic ? "สาธารณะ" : "เฉพาะสมาชิก"}
          </Badge>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">{event.title}</h2>
        {event.description && <p className="text-sm text-gray-700 whitespace-pre-wrap">{event.description}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">สถานที่</p>
            <p className="text-gray-900 mt-1">{event.location || "ไม่ระบุ"}</p>
          </div>
          <div>
            <p className="text-gray-500">เริ่ม</p>
            <p className="text-gray-900 mt-1">{event.startsAt.toLocaleString("th-TH")}</p>
          </div>
          <div>
            <p className="text-gray-500">สิ้นสุด</p>
            <p className="text-gray-900 mt-1">{event.endsAt ? event.endsAt.toLocaleString("th-TH") : "ไม่ระบุ"}</p>
          </div>
          <div className="min-w-0">
            <p className="text-gray-500">{isResidentCreator ? "ผู้ส่งคำขอ" : "ผู้สร้างกิจกรรม"}</p>
            <p className="mt-1 break-words text-gray-900">{creatorLabel}</p>
          </div>
        </div>
      </div>
    </main>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { formatCalendarPerson } from "@/lib/calendar-person";
import { DeleteVillageEventButton } from "./delete-button";

interface PageProps {
  params: Promise<{ eventId: string }>;
}

export default async function VillageEventDetailPage({ params }: PageProps) {
  const { eventId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const event = await prisma.villageEvent.findFirst({
    where: { id: eventId, villageId: membership.villageId },
    include: {
      createdBy: {
        select: {
          name: true,
          systemRole: true,
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

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">รายละเอียดกิจกรรม</h1>
          <p className="text-sm text-gray-500 mt-1">ตรวจสอบหรือแก้ไขข้อมูลกิจกรรม</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Link href={`/admin/calendar/${event.id}/edit`}>
            <Button variant="outline" className="w-full sm:w-auto">แก้ไข</Button>
          </Link>
          <DeleteVillageEventButton eventId={event.id} />
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Badge variant={event.isPublic ? "success" : "info"}>
            {event.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}
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
            <p className="text-gray-500">ผู้สร้างกิจกรรม</p>
            <p className="mt-1 break-words text-gray-900">{formatCalendarPerson(event.createdBy)}</p>
          </div>
        </div>
      </div>
    </main>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
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
  });
  if (!event) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">รายละเอียดกิจกรรม</h1>
          <p className="text-sm text-gray-500 mt-1">ตรวจสอบหรือแก้ไขข้อมูลกิจกรรม</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/calendar/${event.id}/edit`}>
            <Button variant="outline">แก้ไข</Button>
          </Link>
          <DeleteVillageEventButton eventId={event.id} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
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
        </div>
      </div>
    </div>
  );
}

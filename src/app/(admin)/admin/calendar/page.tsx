import Link from "next/link";
import { CalendarPlus, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

type VillageEventSubmissionCountDelegate = {
  count(args: unknown): Promise<number>;
};

export default async function AdminCalendarPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const events = await prisma.villageEvent.findMany({
    where: { villageId: membership.villageId },
    orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      location: true,
      startsAt: true,
      endsAt: true,
      isPublic: true,
    },
  });

  const villageEventSubmission = (
    prisma as unknown as { villageEventSubmission: VillageEventSubmissionCountDelegate }
  ).villageEventSubmission;

  const pendingRequestCount = await villageEventSubmission.count({
    where: {
      villageId: membership.villageId,
      status: "PENDING",
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ปฏิทินกิจกรรม</h1>
          <p className="text-sm text-gray-500 mt-1">เพิ่ม แก้ไข และลบกิจกรรมของหมู่บ้าน</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/calendar/requests">
            <Button size="sm" variant="outline">
              คำขอกิจกรรม {pendingRequestCount > 0 ? `(${pendingRequestCount})` : ""}
            </Button>
          </Link>
          <Link href="/admin/calendar/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> เพิ่มกิจกรรม
            </Button>
          </Link>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <CalendarPlus className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">ยังไม่มีกิจกรรม</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/admin/calendar/${event.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={event.isPublic ? "success" : "info"}>
                      {event.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}
                    </Badge>
                  </div>
                  <p className="font-medium text-gray-900 line-clamp-1">{event.title}</p>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                    {event.location || "ไม่ระบุสถานที่"}
                  </p>
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap">
                  {event.startsAt.toLocaleString("th-TH")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

type ResidentEventDetailPageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function ResidentEventDetailPage({ params }: ResidentEventDetailPageProps) {
  const { eventId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/auth/login");

  const village = await prisma.village.findUnique({
    where: { id: membership.villageId },
    select: { id: true, name: true },
  });
  if (!village) redirect("/auth/login");

  const event = await prisma.villageEvent.findFirst({
    where: {
      id: eventId,
      villageId: village.id,
    },
  });
  if (!event) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/resident/calendar"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> กลับปฏิทินกิจกรรม
      </Link>

      <article className="space-y-5 rounded-xl border border-gray-200 bg-white p-8">
        <div className="flex items-center gap-2">
          <Badge variant={event.isPublic ? "success" : "info"}>
            {event.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}
          </Badge>
          <Badge variant="outline">{village.name}</Badge>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>

        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <div>
            <p className="text-gray-500">วันเวลาเริ่ม</p>
            <p className="mt-1 text-gray-900">{event.startsAt.toLocaleString("th-TH")}</p>
          </div>
          <div>
            <p className="text-gray-500">วันเวลาสิ้นสุด</p>
            <p className="mt-1 text-gray-900">
              {event.endsAt ? event.endsAt.toLocaleString("th-TH") : "ไม่ระบุ"}
            </p>
          </div>
          <div>
            <p className="text-gray-500">สถานที่</p>
            <p className="mt-1 text-gray-900">{event.location || "ไม่ระบุ"}</p>
          </div>
        </div>

        {event.description && (
          <div className="border-t border-gray-100 pt-2">
            <p className="whitespace-pre-wrap leading-7 text-gray-700">{event.description}</p>
          </div>
        )}
      </article>
    </div>
  );
}
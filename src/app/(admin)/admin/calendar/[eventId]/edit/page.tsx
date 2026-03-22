import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { CalendarForm } from "../../calendar-form";

interface PageProps {
  params: Promise<{ eventId: string }>;
}

function toDatetimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export default async function EditVillageEventPage({ params }: PageProps) {
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">แก้ไขกิจกรรม</h1>
        <p className="text-sm text-gray-500 mt-1">อัปเดตข้อมูลกิจกรรมในปฏิทิน</p>
      </div>
      <CalendarForm
        mode="edit"
        eventId={event.id}
        defaultValues={{
          title: event.title,
          description: event.description || "",
          location: event.location || "",
          startsAt: toDatetimeLocalValue(event.startsAt),
          endsAt: event.endsAt ? toDatetimeLocalValue(event.endsAt) : "",
          isPublic: event.isPublic ? "PUBLIC" : "RESIDENT",
        }}
      />
    </div>
  );
}

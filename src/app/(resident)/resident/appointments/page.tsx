import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APPOINTMENT_STAGE_LABELS } from "@/lib/constants";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ResidentAppointmentCard } from "./resident-appointment-card";
import { ResidentPageToolbar } from "@/components/resident/resident-page-toolbar";
import { ResidentAppointmentsToolbar } from "./resident-appointments-toolbar";

interface PageProps { searchParams: Promise<{ q?: string; status?: string; period?: string; sort?: string }> }

const stageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING_APPROVAL: "warning",
  TIME_SUGGESTED: "info",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "default",
  COMPLETED: "info",
};

function slotDateToStr(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export default async function AppointmentsPage({ searchParams }: PageProps) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");

  const query = await searchParams;
  const keyword = query.q?.trim() ?? "";
  const validStatuses = ["PENDING_APPROVAL", "TIME_SUGGESTED", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED"] as const;
  const statuses = Array.from(new Set((query.status ?? "").split(",").filter((value): value is typeof validStatuses[number] => validStatuses.includes(value as typeof validStatuses[number]))));
  const period = query.period === "upcoming" || query.period === "past" ? query.period : "all";
  const sort = query.sort === "oldest" ? "oldest" : "newest";

  const allAppointments = await prisma.appointment.findMany({
    where: { userId: session.id, ...(statuses.length ? { stage: { in: statuses } } : {}), ...(keyword ? { OR: [{ title: { contains: keyword, mode: "insensitive" as const } }, { description: { contains: keyword, mode: "insensitive" as const } }] } : {}) },
    include: { slot: true },
    orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
  });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const filteredAppointments = allAppointments.filter((appointment) => {
    if (period === "all") return true;
    if (!appointment.slot?.date) return false;
    const date = new Date(appointment.slot.date); date.setHours(0, 0, 0, 0);
    return period === "upcoming" ? date >= today : date < today;
  });
  const suggestionTitles = Array.from(new Set(allAppointments.map((appointment) => appointment.title))).slice(0, 20);

  return (
    <div className="space-y-6">
      <ResidentAppointmentsToolbar keyword={keyword} statuses={statuses} period={period} sort={sort} suggestions={suggestionTitles} />
      {/* Legacy toolbar retained below for reference during rollout. */}
      {false && <ResidentPageToolbar
        namespace="resident-appointments"
        title="นัดหมาย"
        actions={<>
          <Link href="/resident/calendar">
            <Button size="sm" variant="outline" className="h-10 px-2 sm:px-3">
              <CalendarDays className="h-4 w-4 mr-1" /> ดูในปฏิทิน
            </Button>
          </Link>
          <Link href="/resident/appointments/new">
            <Button size="sm" className="h-10 px-2 sm:px-3">
              <Plus className="h-4 w-4 mr-1" /> ขอจองนัด
            </Button>
          </Link>
        </>}
      />}

      {/* ─── Appointment list ─── */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">รายการนัดหมายของคุณ</h2>
        {filteredAppointments.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500">
              ยังไม่มีนัดหมาย{" "}
              <Link href="/resident/appointments/new" className="text-green-600 hover:underline">
                ขอจองนัดหมายใหม่
              </Link>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAppointments.map((apt) => (
              <ResidentAppointmentCard
                key={apt.id}
                id={apt.id}
                title={apt.title}
                stage={apt.stage}
                stageLabel={APPOINTMENT_STAGE_LABELS[apt.stage]}
                stageVariant={stageVariant[apt.stage] ?? "default"}
                slotDate={apt.slot?.date ? slotDateToStr(apt.slot.date) : null}
                slotStartTime={apt.slot?.startTime ?? null}
                slotEndTime={apt.slot?.endTime ?? null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { isAdminUser } from "@/lib/access-control";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APPOINTMENT_STAGE_LABELS } from "@/lib/constants";
import { formatThaiDate } from "@/lib/utils";
import { Check, X, AlertCircle } from "lucide-react";

async function fetchPendingAppointments() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id || !isAdminUser(session)) {
    redirect("/auth/login?error=unauthorized");
  }

  // Get admin's villages
  const memberships = await prisma.villageMembership.findMany({
    where: {
      userId: session.id,
      role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] },
    },
    select: { villageId: true },
  });

  const villageIds = memberships.map((m) => m.villageId);

  if (villageIds.length === 0) {
    return [];
  }

  // Fetch appointments from admin's villages, prioritize pending
  const appointments = await prisma.appointment.findMany({
    where: {
      villageId: { in: villageIds },
    },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
      slot: true,
      village: {
        select: { name: true },
      },
      timeline: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: [
      { stage: "asc" }, // PENDING_APPROVAL first
      { createdAt: "desc" },
    ],
  });

  return appointments;
}

const stageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING_APPROVAL: "warning",
  TIME_SUGGESTED: "info",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "default",
  COMPLETED: "info",
};

export default async function AdminAppointmentsPage() {
  const appointments = await fetchPendingAppointments();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">จัดการนัดหมาย</h1>
        <Link href="/admin/appointments/slots">
          <Button size="sm">จัดการเวลาว่าง</Button>
        </Link>
      </div>

      {appointments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">ยังไม่มีคำขอนัดหมาย</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((apt) => (
            <div
              key={apt.id}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Link href={`/admin/appointments/${apt.id}`} className="font-medium text-gray-900 hover:underline">
                      {apt.title}
                    </Link>
                    <Badge variant={stageVariant[apt.stage] ?? "default"}>
                      {APPOINTMENT_STAGE_LABELS[apt.stage]}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                      <p className="text-xs text-gray-400">ผู้ขอ</p>
                      <p>{apt.user?.name || apt.user?.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">หมู่บ้าน</p>
                      <p>{apt.village?.name}</p>
                    </div>
                    {apt.slot && (
                      <div>
                        <p className="text-xs text-gray-400">วันที่</p>
                        <p>{formatThaiDate(apt.slot.date)}</p>
                      </div>
                    )}
                    {apt.slot && (
                      <div>
                        <p className="text-xs text-gray-400">เวลา</p>
                        <p>{apt.slot.startTime} - {apt.slot.endTime}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {apt.stage === "PENDING_APPROVAL" && (
                    <div className="flex gap-2">
                      {apt.slotId ? (
                        <Link href={`/admin/appointments/${apt.id}?action=approve`}>
                          <Button size="sm" variant="primary">
                            <Check className="h-4 w-4" /> อนุมัติ
                          </Button>
                        </Link>
                      ) : (
                        <Link href={`/admin/appointments/${apt.id}?action=suggest`}>
                          <Button size="sm" variant="secondary">
                            <AlertCircle className="h-4 w-4" /> แนะนำเวลา
                          </Button>
                        </Link>
                      )}
                      <Link href={`/admin/appointments/${apt.id}?action=reject`}>
                        <Button size="sm" variant="outline">
                          <X className="h-4 w-4" /> ปฏิเสธ
                        </Button>
                      </Link>
                    </div>
                  )}
                  {apt.stage === "TIME_SUGGESTED" && (
                    <div className="flex gap-2">
                      <Link href={`/admin/appointments/${apt.id}`}>
                        <Button size="sm" variant="secondary">
                          <AlertCircle className="h-4 w-4" /> รอยืนยัน
                        </Button>
                      </Link>
                      <Link href={`/admin/appointments/${apt.id}`}>
                        <Button size="sm" variant="outline">
                          <X className="h-4 w-4" /> ยกเลิก
                        </Button>
                      </Link>
                    </div>
                  )}
                  {apt.stage === "APPROVED" && (
                    <div className="flex gap-2">
                      <Link href={`/admin/appointments/${apt.id}`}>
                        <Button size="sm" variant="outline">
                          <X className="h-4 w-4" /> ยกเลิก
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

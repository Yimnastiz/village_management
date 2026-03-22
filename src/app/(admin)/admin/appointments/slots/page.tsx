import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { isAdminUser } from "@/lib/access-control";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatThaiDate } from "@/lib/utils";
import { ArrowLeft, Plus, Lock, Unlock, Trash2, ChevronLeft, ChevronRight, Pencil } from "lucide-react";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
  "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
  "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

interface PageProps {
  searchParams: Promise<{ month?: string; year?: string; villageId?: string; error?: string; success?: string }>;
}

function safeDecode(value?: string) {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function AdminSlotsPage({ searchParams }: PageProps) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id || !isAdminUser(session)) redirect("/auth/login?error=unauthorized");

  const params = await searchParams;
  const flashError = safeDecode(params.error);
  const flashSuccess = safeDecode(params.success);
  const now = new Date();
  const month = Math.min(12, Math.max(1, parseInt(params.month ?? "", 10) || (now.getMonth() + 1)));
  const year = parseInt(params.year ?? "", 10) || now.getFullYear();

  // Load all villages this admin manages
  const memberships = await prisma.villageMembership.findMany({
    where: {
      userId: session.id,
      role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] },
      status: "ACTIVE",
    },
    select: {
      villageId: true,
      village: { select: { name: true } },
    },
  });

  if (memberships.length === 0) {
    return (
      <div className="space-y-4">
        <Link href="/admin/appointments" className="text-gray-400 hover:text-gray-600 inline-flex">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <p className="text-gray-500">ไม่พบหมู่บ้านที่คุณดูแล</p>
      </div>
    );
  }

  const selectedVillageId = params.villageId && memberships.some(m => m.villageId === params.villageId)
    ? params.villageId
    : memberships[0].villageId;
  const selectedVillage = memberships.find(m => m.villageId === selectedVillageId)!;

  const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59));

  const slots = await prisma.appointmentSlot.findMany({
    where: {
      villageId: selectedVillageId,
      date: { gte: startOfMonth, lte: endOfMonth },
    },
    include: {
      _count: {
        select: {
          appointments: { where: { stage: { notIn: ["CANCELLED", "REJECTED"] } } },
        },
      },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const prevMonth = month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
  const nextMonth = month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year };

  // ─── Server Actions ───────────────────────────────────────────────────────

  async function createSlotAction(formData: FormData) {
    "use server";
    const sess = await getSessionContextFromServerCookies();
    if (!sess?.id || !isAdminUser(sess)) redirect("/auth/login?error=unauthorized");

    const dateStr = formData.get("date") as string;
    const startTime = formData.get("startTime") as string;
    const endTime = formData.get("endTime") as string;
    const capacity = Math.max(1, parseInt((formData.get("maxCapacity") as string) || "1", 10));
    const note = (formData.get("note") as string | null) || undefined;
    const villageId = formData.get("villageId") as string;

    if (!dateStr || !startTime || !endTime || !villageId) {
      redirect(`/admin/appointments/slots?year=${year}&month=${month}&villageId=${villageId}&error=กรุณากรอกข้อมูลให้ครบถ้วน`);
    }

    const access = await prisma.villageMembership.findFirst({
      where: {
        userId: sess.id,
        villageId,
        role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] },
        status: "ACTIVE",
      },
    });
    if (!access) redirect("/admin/appointments/slots?error=ไม่มีสิทธิ์จัดการหมู่บ้านนี้");

    const dateParsed = new Date(dateStr + "T00:00:00Z");
    await prisma.appointmentSlot.create({
      data: {
        villageId,
        date: dateParsed,
        startTime,
        endTime,
        maxCapacity: isNaN(capacity) ? 1 : capacity,
        note: note ?? null,
      },
    });

    const d = dateParsed;
    revalidatePath("/admin/appointments/slots");
    redirect(`/admin/appointments/slots?year=${d.getUTCFullYear()}&month=${d.getUTCMonth() + 1}&villageId=${villageId}`);
  }

  async function toggleBlockAction(formData: FormData) {
    "use server";
    const sess = await getSessionContextFromServerCookies();
    if (!sess?.id || !isAdminUser(sess)) redirect("/auth/login?error=unauthorized");

    const slotId = formData.get("slotId") as string;
    const isBlocked = formData.get("isBlocked") === "true";
    const villageId = formData.get("villageId") as string;
    const qYear = formData.get("year") as string;
    const qMonth = formData.get("month") as string;

    const access = await prisma.villageMembership.findFirst({
      where: { userId: sess.id, villageId, role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] } },
    });
    if (!access) return;

    await prisma.appointmentSlot.update({ where: { id: slotId }, data: { isBlocked } });
    revalidatePath("/admin/appointments/slots");
    redirect(`/admin/appointments/slots?year=${qYear}&month=${qMonth}&villageId=${villageId}`);
  }

  async function deleteSlotAction(formData: FormData) {
    "use server";
    const sess = await getSessionContextFromServerCookies();
    if (!sess?.id || !isAdminUser(sess)) redirect("/auth/login?error=unauthorized");

    const slotId = formData.get("slotId") as string;
    const villageId = formData.get("villageId") as string;
    const qYear = formData.get("year") as string;
    const qMonth = formData.get("month") as string;

    const access = await prisma.villageMembership.findFirst({
      where: { userId: sess.id, villageId, role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] } },
    });
    if (!access) return;

    const activeCount = await prisma.appointment.count({
      where: { slotId, stage: { notIn: ["CANCELLED", "REJECTED"] } },
    });
    if (activeCount > 0) {
      redirect(`/admin/appointments/slots?year=${qYear}&month=${qMonth}&villageId=${villageId}&error=ไม่สามารถลบได้เพราะมีนัดหมายอยู่ในช่วงเวลานี้`);
    }

    await prisma.appointmentSlot.delete({ where: { id: slotId } });
    revalidatePath("/admin/appointments/slots");
    redirect(`/admin/appointments/slots?year=${qYear}&month=${qMonth}&villageId=${villageId}&success=ลบสล็อตเรียบร้อยแล้ว`);
  }

  async function updateSlotAction(formData: FormData) {
    "use server";
    const sess = await getSessionContextFromServerCookies();
    if (!sess?.id || !isAdminUser(sess)) redirect("/auth/login?error=unauthorized");

    const slotId = formData.get("slotId") as string;
    const villageId = formData.get("villageId") as string;
    const qYear = (formData.get("year") as string) || String(year);
    const qMonth = (formData.get("month") as string) || String(month);

    const baseUrl = `/admin/appointments/slots?year=${encodeURIComponent(qYear)}&month=${encodeURIComponent(qMonth)}&villageId=${encodeURIComponent(villageId || selectedVillageId)}`;

    const dateStr = formData.get("date") as string;
    const startTime = formData.get("startTime") as string;
    const endTime = formData.get("endTime") as string;
    const parsedCapacity = parseInt((formData.get("maxCapacity") as string) || "1", 10);
    const maxCapacity = Number.isNaN(parsedCapacity) ? 1 : Math.max(1, parsedCapacity);
    const note = ((formData.get("note") as string | null) || "").trim();

    if (!slotId || !villageId || !dateStr || !startTime || !endTime) {
      redirect(`${baseUrl}&error=${encodeURIComponent("ข้อมูลสำหรับแก้ไขไม่ครบถ้วน")}`);
    }

    try {
      const access = await prisma.villageMembership.findFirst({
        where: {
          userId: sess.id,
          villageId,
          role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] },
          status: "ACTIVE",
        },
      });
      if (!access) {
        redirect(`${baseUrl}&error=${encodeURIComponent("ไม่มีสิทธิ์แก้ไขสล็อต")}`);
      }

      const activeBooked = await prisma.appointment.count({
        where: { slotId, stage: { notIn: ["CANCELLED", "REJECTED"] } },
      });

      if (maxCapacity < activeBooked) {
        redirect(`${baseUrl}&error=${encodeURIComponent(`ความจุใหม่ต้องไม่น้อยกว่าจำนวนที่จองแล้ว (${activeBooked})`)}`);
      }

      const dateParsed = new Date(`${dateStr}T00:00:00Z`);
      if (Number.isNaN(dateParsed.getTime())) {
        redirect(`${baseUrl}&error=${encodeURIComponent("วันที่ไม่ถูกต้อง")}`);
      }

      await prisma.appointmentSlot.update({
        where: { id: slotId },
        data: {
          date: dateParsed,
          startTime,
          endTime,
          maxCapacity,
          note: note || null,
        },
      });

      revalidatePath("/admin/appointments/slots");
      redirect(`${baseUrl}&success=${encodeURIComponent("แก้ไขสล็อตเรียบร้อยแล้ว")}`);
    } catch (error) {
      console.error("Error updating appointment slot:", error);
      redirect(`${baseUrl}&error=${encodeURIComponent("ไม่สามารถแก้ไขสล็อตได้")}`);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const prevLink = `/admin/appointments/slots?year=${prevMonth.year}&month=${prevMonth.month}&villageId=${selectedVillageId}`;
  const nextLink = `/admin/appointments/slots?year=${nextMonth.year}&month=${nextMonth.month}&villageId=${selectedVillageId}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/appointments" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">จัดการเวลาว่างนัดหมาย</h1>
      </div>

      {/* Village tabs (multiple villages) */}
      {memberships.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {memberships.map((m) => (
            <Link
              key={m.villageId}
              href={`/admin/appointments/slots?year=${year}&month=${month}&villageId=${m.villageId}`}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                m.villageId === selectedVillageId
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {m.village.name}
            </Link>
          ))}
        </div>
      )}

      {/* Month navigator */}
      <div className="flex items-center gap-3">
        <Link href={prevLink} className="p-1.5 rounded-lg hover:bg-gray-100 border border-gray-200">
          <ChevronLeft className="h-4 w-4 text-gray-600" />
        </Link>
        <span className="text-base font-semibold text-gray-900 min-w-[160px] text-center">
          {THAI_MONTHS[month - 1]} พ.ศ. {year + 543}
        </span>
        <Link href={nextLink} className="p-1.5 rounded-lg hover:bg-gray-100 border border-gray-200">
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </Link>
        <span className="text-sm text-gray-400 ml-1">· หมู่บ้าน: {selectedVillage.village.name}</span>
      </div>

      {flashError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {flashError}
        </div>
      )}

      {flashSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {flashSuccess}
        </div>
      )}

      {/* ─── Add Slot Form ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4" /> เพิ่มช่วงเวลาว่างใหม่
        </h2>
        <form action={createSlotAction}>
          <input type="hidden" name="villageId" value={selectedVillageId} />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วันที่ *</label>
              <input
                type="date"
                name="date"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เวลาเริ่ม *</label>
              <input
                type="time"
                name="startTime"
                required
                defaultValue="09:00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เวลาสิ้นสุด *</label>
              <input
                type="time"
                name="endTime"
                required
                defaultValue="10:00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รับได้สูงสุด</label>
              <input
                type="number"
                name="maxCapacity"
                min="1"
                max="50"
                defaultValue="1"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                หมายเหตุ <span className="font-normal text-gray-400">(ไม่บังคับ)</span>
              </label>
              <input
                type="text"
                name="note"
                placeholder="เช่น นัดหมายทั่วไป, เอกสารราชการ"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                <Plus className="h-4 w-4 mr-1" /> เพิ่ม
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* ─── Slots List ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">
            เวลาว่างทั้งหมดใน{THAI_MONTHS[month - 1]} พ.ศ. {year + 543}
          </h2>
          <span className="text-sm text-gray-500">{slots.length} รายการ</span>
        </div>

        {slots.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <p className="mb-1">ยังไม่มีช่วงเวลาว่างในเดือนนี้</p>
            <p className="text-sm">เพิ่มช่วงเวลาว่างด้านบนเพื่อให้ลูกบ้านสามารถขอนัดหมายได้</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {slots.map((slot) => {
              const booked = slot._count.appointments;
              const isFull = booked >= slot.maxCapacity;

              return (
                <div key={slot.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{formatThaiDate(slot.date)}</span>
                      <span className="text-sm text-gray-600">
                        {slot.startTime} – {slot.endTime}
                      </span>
                      {slot.isBlocked ? (
                        <Badge variant="danger">บล็อกแล้ว</Badge>
                      ) : isFull ? (
                        <Badge variant="warning">เต็ม</Badge>
                      ) : (
                        <Badge variant="success">ว่าง</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      จองแล้ว {booked} / {slot.maxCapacity} คน
                      {slot.note && ` · ${slot.note}`}
                    </p>
                    <details className="mt-2">
                      <summary className="inline-flex cursor-pointer items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                        <Pencil className="h-3.5 w-3.5" /> แก้ไขสล็อตนี้
                      </summary>
                      <form action={updateSlotAction} className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
                        <input type="hidden" name="slotId" value={slot.id} />
                        <input type="hidden" name="villageId" value={selectedVillageId} />
                        <input type="hidden" name="year" value={year} />
                        <input type="hidden" name="month" value={month} />
                        <input
                          type="date"
                          name="date"
                          defaultValue={slot.date.toISOString().slice(0, 10)}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                          required
                        />
                        <input
                          type="time"
                          name="startTime"
                          defaultValue={slot.startTime}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                          required
                        />
                        <input
                          type="time"
                          name="endTime"
                          defaultValue={slot.endTime}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                          required
                        />
                        <input
                          type="number"
                          name="maxCapacity"
                          min={Math.max(1, booked)}
                          defaultValue={slot.maxCapacity}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                          required
                        />
                        <input
                          type="text"
                          name="note"
                          defaultValue={slot.note ?? ""}
                          placeholder="หมายเหตุ"
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                        />
                        <div className="col-span-2 md:col-span-5 flex justify-end">
                          <Button type="submit" size="sm" variant="outline">
                            บันทึกการแก้ไข
                          </Button>
                        </div>
                      </form>
                    </details>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Block / Unblock */}
                    <form action={toggleBlockAction}>
                      <input type="hidden" name="slotId" value={slot.id} />
                      <input type="hidden" name="isBlocked" value={String(!slot.isBlocked)} />
                      <input type="hidden" name="villageId" value={selectedVillageId} />
                      <input type="hidden" name="year" value={year} />
                      <input type="hidden" name="month" value={month} />
                      <Button
                        type="submit"
                        size="sm"
                        variant={slot.isBlocked ? "secondary" : "ghost"}
                      >
                        {slot.isBlocked ? (
                          <>
                            <Unlock className="h-3.5 w-3.5 mr-1" />เปิดใช้
                          </>
                        ) : (
                          <>
                            <Lock className="h-3.5 w-3.5 mr-1" />บล็อก
                          </>
                        )}
                      </Button>
                    </form>

                    {/* Delete (only when no active bookings) */}
                    {booked === 0 && (
                      <form action={deleteSlotAction}>
                        <input type="hidden" name="slotId" value={slot.id} />
                        <input type="hidden" name="villageId" value={selectedVillageId} />
                        <input type="hidden" name="year" value={year} />
                        <input type="hidden" name="month" value={month} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


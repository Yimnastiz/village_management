import Link from "next/link";
import { Ban, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { BindingRequestStatus } from "@prisma/client";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { submitBindingRequestAction } from "./actions";
import { BindingVillageCombobox } from "./binding-village-combobox";

export default async function ResidentBindingPage() {
  const session = await getSessionContextFromServerCookies();

  const villages = await prisma.village.findMany({
    where: { isActive: true },
    orderBy: [{ province: "asc" }, { district: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      province: true,
      district: true,
      subdistrict: true,
    },
  });

  const latestRequest = session
    ? await prisma.bindingRequest.findFirst({
        where: { userId: session.id },
        orderBy: { createdAt: "desc" },
        include: {
          house: {
            select: {
              houseNumber: true,
            },
          },
          village: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })
    : null;

  const hasPending = latestRequest?.status === BindingRequestStatus.PENDING;
  const statusPresentation = latestRequest
    ? {
        PENDING: { icon: Clock3, label: "รอผู้ใหญ่บ้านตรวจสอบ", className: "border-amber-200 bg-amber-50 text-amber-800" },
        APPROVED: { icon: CheckCircle2, label: "อนุมัติแล้ว", className: "border-green-200 bg-green-50 text-green-800" },
        REJECTED: { icon: XCircle, label: "ถูกปฏิเสธ", className: "border-red-200 bg-red-50 text-red-800" },
        CANCELLED: { icon: Ban, label: "ยกเลิกแล้ว", className: "border-gray-200 bg-gray-50 text-gray-700" },
      }[latestRequest.status]
    : null;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-2">ขอผูกเลขบ้าน</h2>
        <p className="text-sm text-gray-500 mb-6">
          กรอกข้อมูลบ้านเพื่อส่งคำขอผูกเลขบ้านให้ผู้ใหญ่บ้านหรือแอดมินตรวจสอบและอนุมัติ
        </p>
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {session ? (
            <>
              เข้าสู่ระบบแล้วในชื่อ <strong>{session.name || session.phoneNumber}</strong>
              สามารถส่งคำขอผูกเลขบ้านได้จากฟอร์มด้านล่าง
            </>
          ) : (
            <>หน้านี้ดูได้แม้ยังไม่ได้ล็อกอิน แต่ถ้าจะส่งคำขอผูกเลขบ้านต้องเข้าสู่ระบบก่อน</>
          )}
        </div>

        {hasPending && (
          <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            คุณมีคำขอผูกบ้านที่รออนุมัติอยู่แล้ว ระบบจะไม่สร้างคำขอใหม่ซ้ำ แต่จะอัปเดตเลขบ้านและหมายเหตุในคำขอเดิมแทน
          </div>
        )}

        {statusPresentation ? (
          <div className={`mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${statusPresentation.className}`}>
            <statusPresentation.icon className="mt-0.5 h-5 w-5 flex-none" />
            <div>
              <p className="font-semibold">{statusPresentation.label}</p>
              {latestRequest?.status === BindingRequestStatus.REJECTED ? (
                <p className="mt-1">เหตุผล: {latestRequest.reviewNote || "ไม่ได้ระบุเหตุผล"}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <form action={submitBindingRequestAction} className="space-y-4">
          <BindingVillageCombobox villages={villages} initialVillageId={latestRequest?.villageId} disabled={hasPending} />

          <div>
            <label htmlFor="houseNumber" className="mb-1 block text-sm font-medium text-gray-700">
              บ้านเลขที่
            </label>
            <input
              id="houseNumber"
              name="houseNumber"
              required
              defaultValue={latestRequest?.houseNumber ?? latestRequest?.house?.houseNumber ?? ""}
              placeholder="เช่น 123/4"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="note" className="mb-1 block text-sm font-medium text-gray-700">
              หมายเหตุ
            </label>
            <textarea
              id="note"
              name="note"
              defaultValue={latestRequest?.note ?? ""}
              rows={3}
              placeholder="รายละเอียดเพิ่มเติมสำหรับการพิจารณา"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            {hasPending ? "อัปเดตคำขอผูกเลขบ้านเดิม" : latestRequest?.status === BindingRequestStatus.REJECTED ? "แก้ไขคำขอและส่งใหม่" : "ส่งคำขอผูกเลขบ้าน"}
          </button>

          {!session && (
            <p className="mt-2 text-sm text-gray-600">
              คุณต้อง{" "}
              <Link
                href={`/auth/login?callbackUrl=${encodeURIComponent("/resident/binding")}`}
                className="text-green-600 font-medium hover:underline"
              >
                เข้าสู่ระบบ
              </Link>{" "}
              เพื่อส่งคำขอผูกเลขบ้าน
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

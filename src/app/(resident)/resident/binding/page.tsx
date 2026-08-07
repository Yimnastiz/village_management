import Link from "next/link";
import { Ban, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { BindingRequestStatus } from "@prisma/client";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { BindingRequestForm } from "./binding-request-form";
import { CancelBindingButton } from "./cancel-binding-button";

export default async function ResidentBindingPage() {
  const session = await getSessionContextFromServerCookies();

  const villages = await prisma.village.findMany({
    where: { isActive: true },
    orderBy: [{ province: "asc" }, { district: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      moo: true,
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
          house: { select: { houseNumber: true } },
          village: { select: { id: true, name: true } },
        },
      })
    : null;

  const villageIds = villages.map((village) => village.id);
  const houses = villageIds.length
    ? await prisma.house.findMany({
        where: { villageId: { in: villageIds } },
        orderBy: { houseNumber: "asc" },
        select: {
          id: true,
          villageId: true,
          houseNumber: true,
          normalizedHouseNumber: true,
        },
      })
    : [];

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
      <div className="rounded-2xl bg-white p-8 shadow-lg">
        <h2 className="mb-2 text-xl font-bold text-gray-900">ขอผูกเลขบ้าน</h2>
        <p className="mb-6 text-sm text-gray-500">
          เลือกบ้านจากทะเบียนบ้านของหมู่บ้านก่อน หากไม่พบเลขบ้านของคุณ ค่อยส่งเลขบ้านให้ผู้ดูแลตรวจสอบ
        </p>
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {session ? (
            <>
              เข้าสู่ระบบแล้วในชื่อ <strong>{session.name || session.phoneNumber}</strong> สามารถส่งคำขอผูกบ้านได้จากฟอร์มด้านล่าง
            </>
          ) : (
            <>หน้านี้ดูได้แม้ยังไม่ได้เข้าสู่ระบบ แต่ต้องเข้าสู่ระบบก่อนส่งคำขอผูกบ้าน</>
          )}
        </div>

        {hasPending ? (
          <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            คุณมีคำขอผูกบ้านที่รออนุมัติอยู่แล้ว ระบบจะไม่สร้างคำขอใหม่ซ้ำ แต่จะอัปเดตคำขอเดิมแทน
          </div>
        ) : null}
        {hasPending ? <div className="mb-6"><CancelBindingButton /></div> : null}

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

        <BindingRequestForm
          villages={villages}
          houses={houses}
          latestRequest={
            latestRequest
              ? {
                  villageId: latestRequest.villageId,
                  houseId: latestRequest.houseId,
                  houseNumber: latestRequest.houseNumber,
                  note: latestRequest.note,
                }
              : null
          }
          hasPending={hasPending}
          isRejected={latestRequest?.status === BindingRequestStatus.REJECTED}
          signedIn={Boolean(session)}
        />

        {!session ? (
          <p className="mt-4 text-sm text-gray-600">
            คุณต้อง{" "}
            <Link href={`/auth/login?callbackUrl=${encodeURIComponent("/resident/binding")}`} className="font-medium text-green-600 hover:underline">
              เข้าสู่ระบบ
            </Link>{" "}
            เพื่อส่งคำขอผูกบ้าน
          </p>
        ) : null}
      </div>
    </div>
  );
}

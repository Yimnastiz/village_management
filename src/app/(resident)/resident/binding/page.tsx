import Link from "next/link";
import { Ban, CheckCircle2, Clock3, Info, XCircle } from "lucide-react";
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
    select: { id: true, name: true, moo: true, slug: true, province: true, district: true, subdistrict: true },
  });
  const latestRequest = session
    ? await prisma.bindingRequest.findFirst({
        where: { userId: session.id },
        orderBy: { createdAt: "desc" },
        include: { house: { select: { houseNumber: true } }, village: { select: { id: true, name: true } } },
      })
    : null;
  const villageIds = villages.map((village) => village.id);
  const houses = villageIds.length
    ? await prisma.house.findMany({
        where: { villageId: { in: villageIds } },
        orderBy: { houseNumber: "asc" },
        select: { id: true, villageId: true, houseNumber: true, normalizedHouseNumber: true },
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
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="border-b border-gray-200 pb-5">
        <p className="text-sm font-medium text-green-700">บัญชีผู้พักอาศัย</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-950">ผูกบัญชีกับบ้าน</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">เลือกหมู่บ้านและบ้านเลขที่จากทะเบียนบ้าน เพื่อให้ผู้ดูแลยืนยันข้อมูลของคุณ</p>
      </header>

      <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm text-blue-900">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 flex-none text-blue-700" aria-hidden="true" />
          <p>{session ? <>คุณกำลังดำเนินการในชื่อ <strong>{session.name || session.phoneNumber}</strong></> : <>กรุณาเข้าสู่ระบบก่อนส่งคำขอผูกบ้าน</>}</p>
        </div>
      </div>

      {hasPending ? (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <p>มีคำขอที่กำลังรอการยืนยัน คุณสามารถแก้ไขข้อมูลในคำขอเดิมได้</p>
          <CancelBindingButton />
        </div>
      ) : null}

      {statusPresentation ? (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${statusPresentation.className}`}>
          <statusPresentation.icon className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
          <div>
            <p className="font-semibold">{statusPresentation.label}</p>
            {latestRequest?.status === BindingRequestStatus.REJECTED ? <p className="mt-1">เหตุผล: {latestRequest.reviewNote || "ไม่ได้ระบุเหตุผล"}</p> : null}
          </div>
        </div>
      ) : null}

      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <BindingRequestForm
          villages={villages}
          houses={houses}
          latestRequest={latestRequest ? { villageId: latestRequest.villageId, houseId: latestRequest.houseId, houseNumber: latestRequest.houseNumber, note: latestRequest.note } : null}
          hasPending={hasPending}
          isRejected={latestRequest?.status === BindingRequestStatus.REJECTED}
          signedIn={Boolean(session)}
        />
      </section>

      {!session ? <p className="text-center text-sm text-gray-600">คุณต้อง <Link href={`/auth/login?callbackUrl=${encodeURIComponent("/resident/binding")}`} className="font-medium text-green-700 hover:underline">เข้าสู่ระบบ</Link> เพื่อส่งคำขอผูกบ้าน</p> : null}
    </div>
  );
}

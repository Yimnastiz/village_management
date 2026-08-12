import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { BindingRequestStatus } from "@prisma/client";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { MEMBERSHIP_ROLE_LABELS } from "@/lib/constants";
import { CancelBindingButton } from "../cancel-binding-button";

export default async function ResidentBindingPendingPage() {
  const session = await getSessionContextFromServerCookies();
  if (session && getResidentMembership(session)) {
    redirect("/resident/dashboard");
  }

  const latestRequest = session
    ? await prisma.bindingRequest.findFirst({
        where: { userId: session.id, status: { not: BindingRequestStatus.CANCELLED } },
        orderBy: { createdAt: "desc" },
        include: { house: { select: { houseNumber: true } }, village: { select: { name: true } } },
      })
    : null;

  const reviewer = latestRequest?.reviewedBy
    ? await prisma.user.findUnique({ where: { id: latestRequest.reviewedBy }, select: { name: true } })
    : null;
  const reviewerMembership = latestRequest?.reviewedBy && latestRequest.villageId
    ? await prisma.villageMembership.findUnique({
        where: { userId_villageId: { userId: latestRequest.reviewedBy, villageId: latestRequest.villageId } },
        select: { role: true },
      })
    : null;

  if (!latestRequest) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHeader />
        <section className="rounded-xl border border-gray-200 bg-white p-6 text-center sm:p-8">
          <p className="text-sm text-gray-600">ยังไม่มีคำขอผูกเลขบ้าน</p>
          <Link href="/resident/binding" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-green-700 px-4 text-sm font-semibold text-white hover:bg-green-800">เริ่มผูกเลขบ้าน</Link>
        </section>
      </div>
    );
  }

  const isPending = latestRequest.status === BindingRequestStatus.PENDING;
  const isApproved = latestRequest.status === BindingRequestStatus.APPROVED;
  const isRejected = latestRequest.status === BindingRequestStatus.REJECTED;
  const Icon = isApproved ? CheckCircle2 : isRejected ? XCircle : Clock3;
  const tone = isApproved ? "border-green-200 bg-green-50 text-green-900" : isRejected ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900";
  const title = isApproved ? "ผูกเลขบ้านสำเร็จแล้ว" : isRejected ? "คำขอต้องได้รับการแก้ไข" : "กำลังรอผู้ใหญ่บ้านตรวจสอบ";
  const message = isApproved
    ? "บัญชีของคุณได้รับการอนุมัติและพร้อมใช้งานเมนูลูกบ้านแล้ว"
    : isRejected
      ? "ตรวจสอบเหตุผล แล้วแก้ไขข้อมูลก่อนส่งคำขอใหม่"
      : "ผู้ใหญ่บ้านกำลังตรวจสอบข้อมูลคำขอของคุณ";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader />
      <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className={`flex items-start gap-3 rounded-xl border p-4 ${tone}`}>
          <Icon className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-sm leading-6 opacity-85">{message}</p>
          </div>
        </div>

        <dl className="mt-5 divide-y divide-gray-100 text-sm">
          <Detail label="หมู่บ้าน" value={latestRequest.village?.name ?? "-"} />
          <Detail label="บ้านเลขที่" value={latestRequest.houseNumber ?? latestRequest.house?.houseNumber ?? "-"} />
          {isPending ? <Detail label="วันที่ส่ง" value={latestRequest.createdAt.toLocaleString("th-TH")} /> : null}
          {isPending ? <Detail label="หมายเหตุ" value={latestRequest.note ?? "-"} /> : null}
        </dl>

        {isRejected ? <div className="mt-4 break-words rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-900"><span className="font-semibold">เหตุผล:</span> {latestRequest.reviewNote || "กรุณาตรวจสอบข้อมูลแล้วส่งคำขอใหม่อีกครั้ง"}</div> : null}
        {latestRequest.reviewedAt && !isPending ? <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700"><p>ผู้ตรวจสอบ: {reviewer?.name ?? "เจ้าหน้าที่หมู่บ้าน"}</p><p className="mt-1 text-gray-500">{reviewerMembership ? MEMBERSHIP_ROLE_LABELS[reviewerMembership.role] : "เจ้าหน้าที่หมู่บ้าน"} · {latestRequest.reviewedAt.toLocaleString("th-TH")}</p></div> : null}

        {isApproved ? <div className="mt-6"><Link href="/resident/dashboard" className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-green-700 px-4 text-sm font-semibold text-white hover:bg-green-800 sm:w-auto">ไปหน้าแดชบอร์ด</Link></div> : null}
        {isPending ? <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center"><Link href="/resident/binding" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-green-700 px-4 text-sm font-semibold text-white hover:bg-green-800">แก้ไขคำขอ</Link><CancelBindingButton /></div> : null}
        {isRejected ? <div className="mt-6 flex flex-col gap-2 sm:flex-row"><Link href="/resident/binding" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-green-700 px-4 text-sm font-semibold text-white hover:bg-green-800">แก้ไขและส่งคำขอใหม่</Link><Link href="/resident/dashboard" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50">กลับหน้าแดชบอร์ด</Link></div> : null}
      </section>
    </div>
  );
}

function PageHeader() {
  return <header className="border-b border-gray-200 pb-5"><p className="text-sm font-medium text-green-700">บัญชีผู้พักอาศัย</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-950">สถานะคำขอผูกเลขบ้าน</h1><p className="mt-2 text-sm leading-6 text-gray-600">ติดตามผลการตรวจสอบคำขอของคุณได้จากหน้านี้</p></header>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"><dt className="text-gray-500">{label}</dt><dd className="min-w-0 break-words text-left font-medium text-gray-900 sm:max-w-[65%] sm:text-right">{value}</dd></div>;
}

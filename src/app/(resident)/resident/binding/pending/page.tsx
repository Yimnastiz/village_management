import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock3, Globe, XCircle } from "lucide-react";
import { BindingRequestStatus } from "@prisma/client";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { MEMBERSHIP_ROLE_LABELS } from "@/lib/constants";

type PageProps = { searchParams?: Promise<{ membershipStatus?: string; bindingStatus?: string }> };

const STATUS_TEXT: Record<BindingRequestStatus, string> = {
  PENDING: "รอการตรวจสอบ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ต้องแก้ไขคำขอ",
  CANCELLED: "ยกเลิกแล้ว",
};

export default async function ResidentBindingPendingPage({ searchParams }: PageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const session = await getSessionContextFromServerCookies();
  const latestRequest = session
    ? await prisma.bindingRequest.findFirst({
        where: { userId: session.id, status: { not: BindingRequestStatus.CANCELLED } },
        orderBy: { createdAt: "desc" },
        include: {
          house: { select: { houseNumber: true } },
          village: { select: { slug: true, name: true } },
        },
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

  const fallbackStatus = params.membershipStatus === "REJECTED" || params.bindingStatus === "REJECTED" ? BindingRequestStatus.REJECTED : null;
  const currentStatus = latestRequest?.status ?? fallbackStatus;
  const isPending = currentStatus === BindingRequestStatus.PENDING;
  const isApproved = currentStatus === BindingRequestStatus.APPROVED;
  const isRejected = currentStatus === BindingRequestStatus.REJECTED;
  const villageHomeHref = latestRequest?.village?.slug ? `/${latestRequest.village.slug}` : "/";
  const statusStyle = isApproved
    ? "border-green-200 bg-green-50 text-green-900"
    : isRejected
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-blue-200 bg-blue-50 text-blue-900";
  const StatusIcon = isApproved ? CheckCircle2 : isRejected ? XCircle : isPending ? Clock3 : AlertCircle;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="border-b border-gray-200 pb-5">
        <p className="text-sm font-medium text-green-700">บัญชีผู้พักอาศัย</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-950">สถานะคำขอผูกเลขบ้าน</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">ติดตามผลการตรวจสอบคำขอของคุณได้จากหน้านี้</p>
      </header>

      {!latestRequest && !fallbackStatus ? (
        <section className="rounded-xl border border-gray-200 bg-white p-6 text-center">
          <p className="text-sm text-gray-600">ยังไม่มีคำขอผูกเลขบ้าน</p>
          <Link href="/resident/binding" className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg bg-green-700 px-4 text-sm font-semibold text-white hover:bg-green-800">เริ่มส่งคำขอ</Link>
        </section>
      ) : (
        <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <div className={`flex items-start gap-3 rounded-xl border p-4 ${statusStyle}`}>
            <StatusIcon className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
            <div>
              <p className="font-semibold">{currentStatus ? STATUS_TEXT[currentStatus] : "สถานะคำขอ"}</p>
              <p className="mt-1 text-sm opacity-80">
                {isPending ? "ผู้ดูแลกำลังตรวจสอบข้อมูลของคุณ" : isApproved ? "บัญชีของคุณได้รับสิทธิ์ใช้งานเมนูลูกบ้านแล้ว" : "ตรวจสอบข้อมูลและส่งคำขอใหม่ได้จากหน้าแก้ไข"}
              </p>
            </div>
          </div>

          {latestRequest ? (
            <dl className="mt-5 divide-y divide-gray-100 text-sm">
              <div className="flex justify-between gap-4 py-3"><dt className="text-gray-500">หมู่บ้าน</dt><dd className="text-right font-medium text-gray-900">{latestRequest.village?.name ?? "-"}</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt className="text-gray-500">บ้านเลขที่</dt><dd className="text-right font-medium text-gray-900">{latestRequest.houseNumber ?? latestRequest.house?.houseNumber ?? "-"}</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt className="text-gray-500">หมายเหตุ</dt><dd className="max-w-[65%] text-right text-gray-700">{latestRequest.note ?? "-"}</dd></div>
            </dl>
          ) : null}

          {isRejected ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span className="font-semibold">เหตุผล:</span> {latestRequest?.reviewNote || "กรุณาตรวจสอบข้อมูลแล้วส่งคำขอใหม่อีกครั้ง"}</div> : null}

          {latestRequest?.reviewedAt && !isPending ? (
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              <p>ตรวจสอบโดย {reviewer?.name ?? "เจ้าหน้าที่หมู่บ้าน"}</p>
              <p className="mt-1 text-gray-500">{reviewerMembership ? MEMBERSHIP_ROLE_LABELS[reviewerMembership.role] : "เจ้าหน้าที่หมู่บ้าน"} · {latestRequest.reviewedAt.toLocaleString("th-TH")}</p>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            {!isApproved ? <Link href="/resident/binding" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-green-700 px-4 text-sm font-semibold text-white hover:bg-green-800">แก้ไขคำขอ</Link> : <Link href="/resident/dashboard" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-green-700 px-4 text-sm font-semibold text-white hover:bg-green-800">ไปหน้าแดชบอร์ด</Link>}
            {isApproved ? <Link href={villageHomeHref} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"><Globe className="h-4 w-4" />หน้าเว็บหมู่บ้าน</Link> : null}
            <Link href="/resident/dashboard" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50">กลับแดชบอร์ด</Link>
          </div>
        </section>
      )}
    </div>
  );
}

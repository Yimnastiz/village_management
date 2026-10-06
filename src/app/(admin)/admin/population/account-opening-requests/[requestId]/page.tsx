import Link from "next/link";
import { ArrowLeft, House, MailCheck, Phone, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { requireVillagePagePermission } from "@/lib/admin-permission.server";
import { maskEmail } from "@/lib/account-email";
import {
  getOpeningRequestForHeadman,
  HouseAccountOpeningReviewError,
} from "@/lib/house-account-opening-review-service";
import { OpeningRequestReviewActions } from "./review-actions";

const statusLabel = {
  PENDING_EMAIL_VERIFICATION: "รอยืนยันอีเมล",
  PENDING_REVIEW: "รอตรวจสอบ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ปฏิเสธ",
  CANCELLED: "ยกเลิก",
  EXPIRED: "หมดอายุ",
} as const;

const occupancyLabel = {
  OCCUPIED: "มีผู้อยู่อาศัย",
  VACANT: "ว่าง",
  UNDER_CONSTRUCTION: "กำลังก่อสร้าง",
  DEMOLISHED: "รื้อถอนแล้ว",
} as const;

function formatDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok",
        dateStyle: "long",
        timeStyle: "short",
      }).format(value)
    : "-";
}

export default async function Page({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const context = await requireVillagePagePermission("house_account_opening.review", {
    callbackUrl: `/admin/population/account-opening-requests/${requestId}`,
    forbiddenRedirect: "/admin/population",
  });
  let request;
  try {
    request = await getOpeningRequestForHeadman(context.session.id, requestId);
  } catch (error) {
    if (error instanceof HouseAccountOpeningReviewError && error.code === "REQUEST_NOT_FOUND") notFound();
    throw error;
  }
  const email = request.initialEmail?.email ?? request.emailSnapshot;
  const emailVerified = Boolean(request.initialEmail?.verifiedAt);
  const emailDisplay = emailVerified ? email : maskEmail(email);
  const actionable = request.status === "PENDING_REVIEW";
  const statusVariant = request.status === "APPROVED" ? "success" : request.status === "REJECTED" ? "danger" : request.status === "PENDING_REVIEW" ? "warning" : "outline";

  return <div className="space-y-4">
    <Link href="/admin/population/account-opening-requests" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> กลับคำขอเปิดบัญชีบ้าน
    </Link>
    <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">ตรวจสอบคำขอเปิดบัญชีบ้าน</h1>
        <p className="mt-1 break-all text-sm text-slate-500">บ้านเลขที่ {request.house.houseNumber}</p>
      </div>
      {actionable ? <OpeningRequestReviewActions requestId={request.id} houseNumber={request.house.houseNumber} maskedEmail={maskEmail(email)} /> : <Badge variant={statusVariant}>{statusLabel[request.status]}</Badge>}
    </header>

    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-4 ring-1 ring-slate-100 sm:p-5">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900"><House className="h-5 w-5 text-emerald-700" aria-hidden="true" />ข้อมูลบ้าน</h2>
        <dl className="mt-4 divide-y divide-slate-100 text-sm">
          <div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-slate-500">บ้านเลขที่</dt><dd className="break-all text-right font-medium text-slate-900">{request.house.houseNumber}</dd></div>
          <div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-slate-500">หมู่บ้าน</dt><dd className="break-words text-right font-medium text-slate-900">{request.village.name}{request.village.moo ? ` หมู่ ${request.village.moo}` : ""}</dd></div>
          <div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-slate-500">สถานะบ้าน</dt><dd className="font-medium text-slate-900">{occupancyLabel[request.house.occupancyStatus]}</dd></div>
          <div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-slate-500">ประชากรในทะเบียน</dt><dd className="font-medium text-slate-900">{request.house._count.persons.toLocaleString("th-TH")} คน</dd></div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 ring-1 ring-slate-100 sm:p-5">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900"><Users className="h-5 w-5 text-blue-700" aria-hidden="true" />ข้อมูลผู้ขอ</h2>
        <dl className="mt-4 divide-y divide-slate-100 text-sm">
          <div className="py-3"><dt className="text-slate-500">ชื่อ-นามสกุล</dt><dd className="mt-1 break-words font-medium text-slate-900">{request.applicantFirstName} {request.applicantLastName}</dd></div>
          <div className="py-3"><dt className="text-slate-500">เบอร์โทรสำหรับติดต่อ</dt><dd className="mt-1"><a href={`tel:${request.contactPhone}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg text-base font-medium text-green-700 hover:underline"><Phone className="h-4 w-4" aria-hidden="true" />โทรหาผู้ขอ · {request.contactPhone}</a></dd></div>
          <div className="py-3"><dt className="text-slate-500">{emailVerified ? "อีเมลสำหรับเข้าสู่ระบบ" : "อีเมลในคำขอ"}</dt><dd className="mt-1 break-all font-medium text-slate-900">{emailDisplay}</dd><p className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${emailVerified ? "text-green-700" : "text-slate-500"}`}><MailCheck className="h-4 w-4" aria-hidden="true" />{emailVerified ? "ยืนยันอีเมลแล้ว" : "ยังไม่ยืนยันอีเมล"}</p></div>
        </dl>
      </section>
    </div>

    <section className="rounded-xl border border-slate-200 bg-white p-4 ring-1 ring-slate-100 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-slate-900">สถานะ</h2><Badge variant={statusVariant}>{statusLabel[request.status]}</Badge></div>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div><dt className="text-slate-500">การยืนยันอีเมล</dt><dd className={`mt-1 font-medium ${emailVerified ? "text-green-700" : "text-slate-700"}`}>{emailVerified ? "ยืนยันอีเมลแล้ว" : "ยังไม่ยืนยันอีเมล"}</dd></div>
        <div><dt className="text-slate-500">วันที่ส่งคำขอ</dt><dd className="mt-1 font-medium text-slate-900">{formatDate(request.requestedAt)}</dd></div>
        <div><dt className="text-slate-500">วันที่ดำเนินการล่าสุด</dt><dd className="mt-1 font-medium text-slate-900">{formatDate(request.status === "PENDING_REVIEW" ? null : request.reviewedAt ?? request.updatedAt)}</dd></div>
        {request.reviewedBy ? <div><dt className="text-slate-500">ผู้พิจารณา</dt><dd className="mt-1 font-medium text-slate-900">{request.reviewedBy.name}</dd></div> : null}
        {request.status === "REJECTED" ? <div className="sm:col-span-2"><dt className="text-slate-500">เหตุผลในการปฏิเสธ</dt><dd className="mt-1 whitespace-pre-wrap break-words font-medium text-slate-900">{request.rejectionReason ?? "-"}</dd></div> : null}
        {request.status === "APPROVED" && request.activatedUser ? <div className="sm:col-span-2"><dt className="text-slate-500">บัญชีบ้านที่เปิดใช้งาน</dt><dd className="mt-1 break-words font-medium text-slate-900">บ้านเลขที่ {request.house.houseNumber} · อีเมลสำหรับเข้าสู่ระบบ {request.activatedUser.email ?? "-"}</dd><p className="mt-1 text-xs text-slate-500">เปิดใช้งาน {formatDate(request.activatedUser.residentHouseAccount?.activatedAt ?? null)}</p></div> : null}
      </dl>
    </section>
  </div>;
}

import Link from "next/link";
import { BindingRequestStatus } from "@prisma/client";
import { Clock } from "lucide-react";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { MEMBERSHIP_ROLE_LABELS } from "@/lib/constants";

type PageProps = {
  searchParams?: Promise<{ membershipStatus?: string; bindingStatus?: string }>;
};

const STATUS_TEXT: Record<BindingRequestStatus, string> = {
  PENDING: "รอพิจารณา",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ปฏิเสธแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
};

export default async function ResidentBindingPendingPage({ searchParams }: PageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const session = await getSessionContextFromServerCookies();

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
              slug: true,
              name: true,
            },
          },
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

    const membershipStatus = params.membershipStatus ?? null;
    const bindingStatus = params.bindingStatus ?? null;
  const isApproved = latestRequest?.status === BindingRequestStatus.APPROVED;
    const isRejected = latestRequest?.status === BindingRequestStatus.REJECTED || membershipStatus === "REJECTED" || bindingStatus === "REJECTED";
    const currentStatus = latestRequest?.status ?? (membershipStatus as BindingRequestStatus | null) ?? (bindingStatus as BindingRequestStatus | null) ?? null;
  const villageHomeHref = latestRequest?.village?.slug ? `/${latestRequest.village.slug}` : "/";

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
      <div className={`inline-flex p-4 rounded-full mb-4 ${isApproved ? "bg-green-50" : "bg-yellow-50"}`}>
        <Clock className={`h-8 w-8 ${isApproved ? "text-green-500" : "text-yellow-500"}`} />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">สถานะคำขอผูกเลขบ้าน</h2>

      {latestRequest ? (
        <>
          {isApproved && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm font-semibold text-green-800">คำขอของคุณได้รับการอนุมัติแล้ว</p>
              <p className="mt-1 text-sm text-green-700">ตอนนี้คุณสามารถใช้งานข้อมูลภายในหมู่บ้านได้ตามสิทธิ์ของลูกบ้าน</p>
            </div>
          )}
          {isRejected && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-left">
              <p className="text-sm font-semibold text-red-800">คำขอของคุณถูกปฏิเสธ</p>
              <p className="mt-1 text-sm text-red-700">{latestRequest?.reviewNote || "กรุณาตรวจสอบข้อมูลแล้วส่งคำขอใหม่อีกครั้ง"}</p>
            </div>
          )}
          {currentStatus && (
            <p className="text-gray-500 text-sm mb-2">
              สถานะปัจจุบัน: <span className="font-semibold">{STATUS_TEXT[currentStatus] ?? currentStatus}</span>
            </p>
          )}
          <p className="text-gray-500 text-sm mb-2">บ้านเลขที่: {latestRequest.houseNumber ?? latestRequest.house?.houseNumber ?? "-"}</p>
          <p className="text-gray-500 text-sm mb-6">หมายเหตุ: {latestRequest.note ?? "-"}</p>
          {latestRequest.reviewedAt && latestRequest.status !== BindingRequestStatus.CANCELLED ? (
            <div className="mx-auto mb-6 max-w-lg rounded-lg border border-gray-200 bg-gray-50 p-3 text-left text-sm text-gray-700">
              <p><span className="text-gray-500">ผู้ตรวจ:</span> {reviewer?.name ?? "เจ้าหน้าที่หมู่บ้าน"}</p>
              <p><span className="text-gray-500">ตำแหน่ง:</span> {reviewerMembership ? MEMBERSHIP_ROLE_LABELS[reviewerMembership.role] : "เจ้าหน้าที่หมู่บ้าน"}</p>
              <p><span className="text-gray-500">ตรวจเมื่อ:</span> {latestRequest.reviewedAt.toLocaleString("th-TH")}</p>
              {latestRequest.status === BindingRequestStatus.REJECTED ? <p><span className="text-gray-500">เหตุผล:</span> {latestRequest.reviewNote || "ไม่ได้ระบุเหตุผล"}</p> : null}
              <Link href="/resident/contacts" className="mt-2 inline-block text-green-700 hover:underline">ดูข้อมูลติดต่อหมู่บ้าน</Link>
            </div>
          ) : null}

          {isApproved && (
            <div className="mb-6 flex flex-wrap items-center justify-center gap-3 text-sm">
              <Link href="/resident/dashboard" className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700">
                ไปที่หน้าแดชบอร์ดลูกบ้าน
              </Link>
              <Link href={villageHomeHref} className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50">
                ไปหน้าหลักเว็บหมู่บ้าน
              </Link>
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-500 text-sm mb-6">ยังไม่มีคำขอผูกเลขบ้าน</p>
      )}

      <div className="flex items-center justify-center gap-4 text-sm">
        <Link href="/resident/binding" className="text-green-600 hover:underline">
          {isRejected ? "สมัคร/แก้ไขใหม่" : "แก้ไขคำขอ"}
        </Link>
        <Link href="/resident/dashboard" className="text-gray-500 hover:underline">
          กลับแดชบอร์ด
        </Link>
      </div>
    </div>
  );
}

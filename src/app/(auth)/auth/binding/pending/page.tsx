import Link from "next/link";
import { BindingRequestStatus } from "@prisma/client";
import { Clock } from "lucide-react";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

const STATUS_TEXT: Record<BindingRequestStatus, string> = {
  PENDING: "รอพิจารณา",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ปฏิเสธแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
};

export default async function BindingPendingPage() {
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

  const isApproved = latestRequest?.status === BindingRequestStatus.APPROVED;
  const villageHomeHref = latestRequest?.village?.slug
    ? `/${latestRequest.village.slug}`
    : "/";

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
      <div
        className={`inline-flex p-4 rounded-full mb-4 ${
          isApproved ? "bg-green-50" : "bg-yellow-50"
        }`}
      >
        <Clock className={`h-8 w-8 ${isApproved ? "text-green-500" : "text-yellow-500"}`} />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">สถานะคำขอผูกเลขบ้าน</h2>

      {latestRequest ? (
        <>
          {isApproved && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm font-semibold text-green-800">
                คำขอของคุณได้รับการอนุมัติแล้ว
              </p>
              <p className="mt-1 text-sm text-green-700">
                ตอนนี้คุณสามารถใช้งานข้อมูลภายในหมู่บ้านได้ตามสิทธิ์ของลูกบ้าน
              </p>
            </div>
          )}
          <p className="text-gray-500 text-sm mb-2">
            สถานะปัจจุบัน: <span className="font-semibold">{STATUS_TEXT[latestRequest.status]}</span>
          </p>
          <p className="text-gray-500 text-sm mb-2">
            บ้านเลขที่: {latestRequest.houseNumber ?? latestRequest.house?.houseNumber ?? "-"}
          </p>
          <p className="text-gray-500 text-sm mb-6">หมายเหตุ: {latestRequest.note ?? "-"}</p>

          {isApproved && (
            <div className="mb-6 flex flex-wrap items-center justify-center gap-3 text-sm">
              <Link
                href="/resident/dashboard"
                className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
              >
                ไปที่หน้าแดชบอร์ดลูกบ้าน
              </Link>
              <Link
                href={villageHomeHref}
                className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
              >
                ไปหน้าหลักเว็บหมู่บ้าน
              </Link>
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-500 text-sm mb-6">ยังไม่มีคำขอผูกเลขบ้าน</p>
      )}

      <div className="flex items-center justify-center gap-4 text-sm">
        <Link href="/auth/binding" className="text-green-600 hover:underline">
          แก้ไขคำขอ
        </Link>
        <Link href="/" className="text-gray-500 hover:underline">
          กลับหน้าหลัก
        </Link>
      </div>
    </div>
  );
}

import Link from "next/link";
import { BindingRequestStatus, MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { maskNationalId } from "@/lib/utils";
import { maskPhone } from "@/features/village-workspace/server/queries";
import { prisma } from "@/lib/prisma";
import { findBoundIdentityByNationalId, getNationalIdForUser } from "@/lib/identity";
import { BindingReviewForm } from "../../binding-review-form";
import { handleBindingRequestAction, verifyHouseForBindingAction } from "../../page";

const labels = { APPROVED: "อนุมัติแล้ว", REJECTED: "ปฏิเสธ", CANCELLED: "ยกเลิก", PENDING: "รอพิจารณา" } as const;

export default async function Page({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const session = await getSessionContextFromServerCookies();
  if (!session || !isAdminUser(session)) redirect("/admin/population");

  const villageIds = session.memberships
    .filter((item) => item.status === MembershipStatus.ACTIVE && item.role !== VillageMembershipRole.RESIDENT)
    .map((item) => item.villageId);
  const request = await prisma.bindingRequest.findFirst({
    where: { id: requestId, villageId: { in: villageIds } },
    include: {
      user: { select: { name: true, phoneNumber: true, person: { select: { nationalId: true, houseId: true, house: { select: { houseNumber: true } } } } } },
      house: { select: { id: true, villageId: true, houseNumber: true } },
      village: { select: { name: true } },
    },
  });
  if (!request) redirect("/admin/population/binding-requests");

  const canReview = request.status === BindingRequestStatus.PENDING && session.memberships.some((item) =>
    item.villageId === request.villageId
    && item.status === MembershipStatus.ACTIVE
    && (item.role === VillageMembershipRole.HEADMAN || item.role === VillageMembershipRole.ASSISTANT_HEADMAN));
  const nationalId = request.villageId ? await getNationalIdForUser(prisma, request.userId, request.villageId) : null;
  const [houses, claimedIdentity, reviewer] = await Promise.all([
    request.villageId ? prisma.house.findMany({ where: { villageId: request.villageId }, select: { id: true, houseNumber: true }, orderBy: { houseNumber: "asc" } }) : [],
    request.villageId && nationalId ? findBoundIdentityByNationalId(prisma, nationalId, request.userId, request.villageId) : null,
    request.reviewedBy ? prisma.user.findUnique({ where: { id: request.reviewedBy }, select: { name: true } }) : null,
  ]);

  // houseNumber is the immutable snapshot of what the resident requested.
  const requestedHouseNumber = request.houseNumber ?? request.house?.houseNumber ?? null;
  const resolvedHouse = request.house?.villageId === request.villageId ? request.house : null;
  const isMissingHouse = !resolvedHouse;
  const houseMismatch = Boolean(request.user.person?.houseId && resolvedHouse?.id && request.user.person.houseId !== resolvedHouse.id);

  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><Link href="/admin/population/binding-requests" className="text-sm font-medium text-slate-600 hover:text-slate-900">← กลับคำขอผูกเลขบ้าน</Link><h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">ตรวจสอบคำขอผูกเลขบ้าน</h1><p className="mt-1 text-sm text-gray-500">{request.village?.name ?? "หมู่บ้าน"}</p></div>
      <Badge variant={request.status === "APPROVED" ? "success" : request.status === "REJECTED" ? "danger" : request.status === "CANCELLED" ? "outline" : "warning"}>{labels[request.status]}</Badge>
    </header>

    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <h2 className="font-semibold text-gray-900">ข้อมูลผู้ขอ</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-gray-500">ชื่อ</dt><dd className="mt-1 break-words font-medium text-gray-900">{request.user.name}</dd></div>
          <div><dt className="text-gray-500">เบอร์โทร</dt><dd className="mt-1 font-medium text-gray-900">{maskPhone(request.user.phoneNumber)}</dd></div>
          <div><dt className="text-gray-500">เลขบัตรประชาชน</dt><dd className="mt-1 font-medium text-gray-900">{nationalId ? maskNationalId(nationalId) : "ไม่พบข้อมูล"}</dd></div>
          <div><dt className="text-gray-500">วันที่ยื่นคำขอ</dt><dd className="mt-1 font-medium text-gray-900">{request.createdAt.toLocaleString("th-TH")}</dd></div>
        </dl>
      </section>
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <h2 className="font-semibold text-gray-900">บ้านที่ขอ</h2>
        <p className="mt-4 break-words text-2xl font-semibold text-gray-900">{requestedHouseNumber ?? "ไม่ระบุเลขบ้าน"}</p>
        {isMissingHouse
          ? <p className={`mt-2 text-sm ${request.status === "PENDING" ? "text-amber-800" : "text-gray-600"}`}>{request.status === "PENDING" ? `ไม่พบบ้านเลขที่ ${requestedHouseNumber ?? "-"} ในทะเบียนบ้าน` : "ไม่พบเลขบ้านนี้ในทะเบียนบ้านขณะพิจารณาคำขอ"}</p>
          : <p className="mt-2 flex items-center gap-1 text-sm font-medium text-emerald-700"><span aria-hidden>✓</span> พบในทะเบียนบ้านแล้ว</p>}
      </section>
    </div>

    {request.status === BindingRequestStatus.PENDING && canReview ? <BindingReviewForm
      requestId={request.id}
      applicantName={request.user.name}
      houseId={resolvedHouse?.id ?? null}
      requestedHouseNumber={requestedHouseNumber}
      resolvedHouseNumber={resolvedHouse?.houseNumber ?? null}
      houses={houses}
      reviewAction={handleBindingRequestAction}
      verifyAction={verifyHouseForBindingAction}
      houseMismatch={houseMismatch}
      personHouseNumber={request.user.person?.house?.houseNumber ?? null}
      nationalIdClaimed={Boolean(claimedIdentity)}
    /> : request.status === BindingRequestStatus.PENDING ? <section className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600 sm:p-5">คำขอนี้ดูได้ แต่ต้องให้ผู้ใหญ่บ้านหรือผู้ช่วยผู้ใหญ่บ้านเป็นผู้พิจารณา</section> : <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <h2 className="font-semibold text-gray-900">ผลการพิจารณา</h2>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-gray-500">ผู้พิจารณา</dt><dd className="mt-1 font-medium">{reviewer?.name ?? "-"}</dd></div><div><dt className="text-gray-500">วันเวลา</dt><dd className="mt-1 font-medium">{request.reviewedAt?.toLocaleString("th-TH") ?? "-"}</dd></div><div className="sm:col-span-2"><dt className="text-gray-500">เหตุผล / หมายเหตุ</dt><dd className="mt-1 break-words font-medium">{request.reviewNote ?? "-"}</dd></div></dl>
    </section>}
  </div>;
}

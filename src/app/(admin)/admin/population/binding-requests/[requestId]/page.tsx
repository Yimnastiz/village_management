import Link from "next/link";
import { BindingRequestStatus, MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { maskNationalId } from "@/lib/utils";
import { maskPhone } from "@/features/village-workspace/server/queries";
import { prisma } from "@/lib/prisma";
import { findBoundIdentityByNationalId } from "@/lib/identity";
import { BindingReviewForm } from "../../binding-review-form";
import { handleBindingRequestAction, verifyHouseForBindingAction } from "../../page";

const labels = { APPROVED: "อนุมัติแล้ว", REJECTED: "ปฏิเสธ", CANCELLED: "ยกเลิก", PENDING: "รอพิจารณา" } as const;

export default async function Page({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const session = await getSessionContextFromServerCookies();
  if (!session || !isAdminUser(session)) redirect("/admin/population");
  const villageIds = session.memberships.filter((item) => item.status === MembershipStatus.ACTIVE && item.role !== VillageMembershipRole.RESIDENT).map((item) => item.villageId);
  const request = await prisma.bindingRequest.findFirst({ where: { id: requestId, villageId: { in: villageIds } }, include: { user: { select: { name: true, phoneNumber: true, person: { select: { nationalId: true, houseId: true, house: { select: { houseNumber: true } } } } } }, house: { select: { houseNumber: true } }, village: { select: { name: true } } } });
  if (!request) redirect("/admin/population/binding-requests");
  const canReview = request.status === BindingRequestStatus.PENDING && session.memberships.some((item) => item.villageId === request.villageId && item.status === MembershipStatus.ACTIVE && (item.role === VillageMembershipRole.HEADMAN || item.role === VillageMembershipRole.ASSISTANT_HEADMAN));
  const [houses, claimedIdentity, reviewer] = await Promise.all([
    request.villageId ? prisma.house.findMany({ where: { villageId: request.villageId }, select: { id: true, houseNumber: true }, orderBy: { houseNumber: "asc" }, take: 200 }) : [],
    request.villageId && request.user.person?.nationalId ? findBoundIdentityByNationalId(prisma, request.user.person.nationalId, request.userId, request.villageId) : null,
    request.reviewedBy ? prisma.user.findUnique({ where: { id: request.reviewedBy }, select: { name: true } }) : null,
  ]);
  const requestedHouseNumber = request.house?.houseNumber ?? request.houseNumber;
  const isMissingHouse = !request.houseId;
  const houseMismatch = Boolean(request.user.person?.houseId && request.houseId && request.user.person.houseId !== request.houseId);
  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><Link href="/admin/population/binding-requests" className="text-sm font-medium text-slate-600 hover:text-slate-900">← กลับคำขอผูกเลขบ้าน</Link><h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">ตรวจสอบคำขอผูกเลขบ้าน</h1><p className="mt-1 text-sm text-gray-500">{request.village?.name ?? "หมู่บ้าน"}</p></div><Badge variant={request.status === "APPROVED" ? "success" : request.status === "REJECTED" ? "danger" : request.status === "CANCELLED" ? "outline" : "warning"}>{labels[request.status]}</Badge></header>
    <div className="grid gap-4 lg:grid-cols-2"><section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><h2 className="font-semibold text-gray-900">ข้อมูลผู้ขอ</h2><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-gray-500">ชื่อ</dt><dd className="mt-1 font-medium text-gray-900">{request.user.name}</dd></div><div><dt className="text-gray-500">เบอร์โทร</dt><dd className="mt-1 font-medium text-gray-900">{maskPhone(request.user.phoneNumber)}</dd></div><div><dt className="text-gray-500">เลขบัตรประชาชน</dt><dd className="mt-1 font-medium text-gray-900">{request.user.person?.nationalId ? maskNationalId(request.user.person.nationalId) : "ไม่พบข้อมูล"}</dd></div><div><dt className="text-gray-500">วันที่ยื่นคำขอ</dt><dd className="mt-1 font-medium text-gray-900">{request.createdAt.toLocaleString("th-TH")}</dd></div></dl></section>
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><h2 className="font-semibold text-gray-900">บ้านที่ขอ</h2><p className="mt-4 text-2xl font-semibold text-gray-900">{requestedHouseNumber ?? "ไม่ระบุเลขบ้าน"}</p>{isMissingHouse ? <p className="mt-2 text-sm text-amber-800">ไม่พบเลขบ้านนี้ในทะเบียนบ้าน ต้องสร้างหรือจับคู่ก่อนอนุมัติ</p> : <p className="mt-2 text-sm text-emerald-700">พบในทะเบียนบ้านแล้ว</p>}{request.user.person?.house ? <p className="mt-4 border-t pt-3 text-sm text-gray-600">ข้อมูลประชากรเดิม: บ้านเลขที่ {request.user.person.house.houseNumber}</p> : null}</section></div>
    {request.status === BindingRequestStatus.PENDING && canReview ? <BindingReviewForm requestId={request.id} applicantName={request.user.name} houseId={request.houseId} houseNumber={requestedHouseNumber} houses={houses} reviewAction={handleBindingRequestAction} verifyAction={verifyHouseForBindingAction} houseMismatch={houseMismatch} nationalIdClaimed={Boolean(claimedIdentity)} /> : <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><h2 className="font-semibold text-gray-900">ผลการพิจารณา</h2><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-gray-500">ผู้พิจารณา</dt><dd className="mt-1 font-medium">{reviewer?.name ?? "-"}</dd></div><div><dt className="text-gray-500">วันเวลา</dt><dd className="mt-1 font-medium">{request.reviewedAt?.toLocaleString("th-TH") ?? "-"}</dd></div><div className="sm:col-span-2"><dt className="text-gray-500">เหตุผล / หมายเหตุ</dt><dd className="mt-1 font-medium">{request.reviewNote ?? "-"}</dd></div></dl></section>}
  </div>;
}

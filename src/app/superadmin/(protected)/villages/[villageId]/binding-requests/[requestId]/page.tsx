import { BindingRequestStatus, SystemRole, VillageMembershipRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { Badge } from "@/components/ui/badge";
import { BINDING_REQUEST_STATUS_LABELS, MEMBERSHIP_ROLE_LABELS, PERSON_STATUS_LABELS } from "@/lib/constants";
import { personStatusBadgeVariant } from "@/features/population/person-status";
import { prisma } from "@/lib/prisma";
import { getNationalIdForUser } from "@/lib/identity";
import { reconcileBindingPersonIdentity } from "@/lib/binding-identity-reconciliation";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { maskNationalId } from "@/lib/utils";
import { BindingReviewForm } from "../../binding-review-form";

function statusVariant(status: BindingRequestStatus): "success" | "danger" | "outline" | "warning" {
  if (status === BindingRequestStatus.APPROVED) return "success";
  if (status === BindingRequestStatus.REJECTED) return "danger";
  if (status === BindingRequestStatus.CANCELLED) return "outline";
  return "warning";
}

function reviewerRoleLabel(reviewer: { systemRole: SystemRole; memberships: { role: VillageMembershipRole }[] } | null) {
  if (!reviewer) return "-";
  if (reviewer.systemRole === SystemRole.SUPERADMIN) return "ผู้ดูแลระบบระดับสูง";
  return reviewer.memberships[0] ? MEMBERSHIP_ROLE_LABELS[reviewer.memberships[0].role] : "ผู้ดูแลหมู่บ้าน";
}

export default async function Page({ params }: { params: Promise<{ villageId: string; requestId: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId, requestId } = await params;
  const request = await prisma.bindingRequest.findFirst({
    where: { id: requestId, villageId },
    include: {
      village: { select: { name: true } },
      house: { select: { id: true, villageId: true, houseNumber: true, persons: { where: { villageId }, select: { id: true, firstName: true, lastName: true, nationalId: true, status: true } } } },
      user: { select: { id: true, name: true, phoneNumber: true, person: { select: { houseId: true, house: { select: { houseNumber: true } } } } } },
    },
  });
  if (!request || (request.house && request.house.villageId !== villageId)) notFound();

  const [houses, nationalId, registration, reviewer] = await Promise.all([
    prisma.house.findMany({ where: { villageId }, select: { id: true, houseNumber: true }, orderBy: { houseNumber: "asc" } }),
    getNationalIdForUser(prisma, request.user.id, villageId),
    prisma.registrationTemp.findFirst({ where: { userId: request.user.id, villageId, status: "VERIFIED" }, orderBy: { updatedAt: "desc" }, select: { dateOfBirth: true } }),
    request.reviewedBy ? prisma.user.findUnique({ where: { id: request.reviewedBy }, select: { name: true, systemRole: true, memberships: { where: { villageId }, select: { role: true }, take: 1 } } }) : null,
  ]);
  const identityReconciliation = await reconcileBindingPersonIdentity(prisma, { villageId, nationalId, applicantUserId: request.user.id });
  const identityForReview = identityReconciliation.kind === "single_unlinked_match" || identityReconciliation.kind === "multiple_matches" || identityReconciliation.kind === "linked_to_another_user"
    ? { kind: identityReconciliation.kind, ...(identityReconciliation.kind === "single_unlinked_match" || identityReconciliation.kind === "linked_to_another_user" ? { person: { name: `${identityReconciliation.person.firstName} ${identityReconciliation.person.lastName}`, nationalIdMasked: identityReconciliation.person.nationalId ? maskNationalId(identityReconciliation.person.nationalId) : "-", dateOfBirth: identityReconciliation.person.dateOfBirth?.toLocaleDateString("th-TH") ?? null, phone: identityReconciliation.person.phone, houseNumber: identityReconciliation.person.house?.houseNumber ?? null, source: identityReconciliation.person.house ? `${identityReconciliation.person.house.sourceType}${identityReconciliation.person.house.sourceNote ? `: ${identityReconciliation.person.house.sourceNote}` : ""}` : null } } : {}) }
    : undefined;
  const base = `/superadmin/villages/${villageId}/binding-requests`;
  const requestedHouseNumber = request.houseNumber ?? request.house?.houseNumber ?? null;
  const resolvedHouse = request.house?.villageId === villageId ? request.house : null;
  const existingPersonHouse = identityReconciliation.kind === "single_unlinked_match" || identityReconciliation.kind === "linked_to_another_user"
    ? identityReconciliation.person.house?.houseNumber ?? null
    : request.user.person?.house?.houseNumber ?? null;
  const existingPersonHouseId = identityReconciliation.kind === "single_unlinked_match" || identityReconciliation.kind === "linked_to_another_user"
    ? identityReconciliation.person.houseId
    : request.user.person?.houseId ?? null;
  const houseMismatch = Boolean(existingPersonHouseId && resolvedHouse?.id && existingPersonHouseId !== resolvedHouse.id);

  return <div className="space-y-5">
    <AdminPageToolbar title="ตรวจสอบคำขอผูกเลขบ้าน" description={`${request.village?.name ?? "หมู่บ้าน"} · ยื่นเมื่อ ${request.createdAt.toLocaleString("th-TH")}`} backHref={base} backLabel="กลับคำขอผูกบ้าน" backPlacement="header-start" actions={<Badge variant={statusVariant(request.status)}>{BINDING_REQUEST_STATUS_LABELS[request.status]}</Badge>} />
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><h2 className="font-semibold text-gray-900">ข้อมูลผู้ยื่นคำขอ</h2><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><Detail label="ชื่อ" value={request.user.name} /><Detail label="เบอร์โทร" value={request.user.phoneNumber} /><Detail label="เลขบัตรประชาชน" value={nationalId ? maskNationalId(nationalId) : "ไม่พบข้อมูล"} /><Detail label="วันที่ยื่นคำขอ" value={request.createdAt.toLocaleString("th-TH")} /></dl></section>
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><h2 className="font-semibold text-gray-900">บ้านที่ขอ</h2><p className="mt-4 break-words text-2xl font-semibold text-gray-900">{requestedHouseNumber ?? "ไม่ระบุเลขบ้าน"}</p>{resolvedHouse ? <p className="mt-2 text-sm font-medium text-emerald-700">พบในทะเบียนบ้านแล้ว</p> : <p className="mt-2 text-sm font-medium text-amber-800">ไม่พบบ้านเลขที่ {requestedHouseNumber ?? "-"} ในทะเบียนบ้าน</p>}</section>
    </div>
    {houseMismatch ? <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><h2 className="font-semibold">บ้านของบุคคลไม่ตรงกับบ้านที่ขอ</h2><p className="mt-1">บุคคลที่ตรงกันอยู่บ้านเลขที่ {existingPersonHouse ?? "-"} แต่คำขอนี้ระบุบ้านเลขที่ {requestedHouseNumber ?? "-"} การอนุมัติจะไม่ย้ายข้อมูลโดยอัตโนมัตินอกขั้นตอนอนุมัติที่มีเหตุผลรองรับ</p></section> : null}
    {resolvedHouse ? <section className="overflow-hidden rounded-xl border border-gray-200 bg-white"><div className="border-b border-gray-200 px-4 py-3"><h2 className="font-semibold text-gray-900">บุคคลในบ้านที่ขอ</h2></div>{resolvedHouse.persons.length ? <div className="overflow-x-auto"><table className="min-w-[560px] w-full text-sm"><thead className="bg-gray-50 text-left text-gray-600"><tr><th scope="col" className="px-4 py-3">ชื่อ</th><th scope="col" className="px-4 py-3">เลขบัตรประชาชน</th><th scope="col" className="px-4 py-3">สถานะ</th></tr></thead><tbody>{resolvedHouse.persons.map((person) => <tr key={person.id} className="border-t border-gray-100"><td className="px-4 py-3 font-medium text-gray-900">{person.firstName} {person.lastName}</td><td className="px-4 py-3 text-gray-700">{person.nationalId ? maskNationalId(person.nationalId) : "-"}</td><td className="px-4 py-3"><Badge variant={personStatusBadgeVariant(person.status)}>{PERSON_STATUS_LABELS[person.status] ?? person.status}</Badge></td></tr>)}</tbody></table></div> : <p className="px-4 py-8 text-center text-sm text-gray-500">ยังไม่มีบุคคลในทะเบียนบ้านนี้</p>}</section> : null}
    {request.status === BindingRequestStatus.PENDING ? <BindingReviewForm villageName={request.village?.name ?? "หมู่บ้านนี้"} requestId={request.id} proposed={!resolvedHouse} houses={houses} identityReconciliation={identityForReview} applicantName={request.user.name} applicantPhone={request.user.phoneNumber} applicantDateOfBirth={registration?.dateOfBirth?.toLocaleDateString("th-TH") ?? null} requestedHouseNumber={requestedHouseNumber} /> : <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><h2 className="font-semibold text-gray-900">ประวัติการพิจารณา</h2><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><Detail label="ผู้พิจารณา" value={reviewer?.name ?? "-"} /><Detail label="บทบาท" value={reviewerRoleLabel(reviewer)} /><Detail label="วันที่/เวลา" value={request.reviewedAt?.toLocaleString("th-TH") ?? "-"} /><Detail label="เหตุผล / หมายเหตุ" value={request.reviewNote ?? "-"} className="sm:col-span-2" /></dl></section>}
  </div>;
}

function Detail({ label, value, className }: { label: string; value: string; className?: string }) {
  return <div className={className}><dt className="text-gray-500">{label}</dt><dd className="mt-1 break-words font-medium text-gray-900">{value}</dd></div>;
}

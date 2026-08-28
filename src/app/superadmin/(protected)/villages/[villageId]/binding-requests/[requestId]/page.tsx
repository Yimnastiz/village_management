import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { getNationalIdForUser } from "@/lib/identity";
import { reconcileBindingPersonIdentity } from "@/lib/binding-identity-reconciliation";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { maskNationalId } from "@/lib/utils";
import { maskPhone } from "@/features/village-workspace/server/queries";
import { BindingReviewForm } from "../../binding-review-form";
import { reviewBindingForWorkspaceAction } from "../../actions";

export default async function Page({ params }: { params: Promise<{ villageId: string; requestId: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId, requestId } = await params;
  const request = await prisma.bindingRequest.findFirst({ where: { id: requestId, villageId }, include: { village: { select: { name: true } }, house: { select: { id: true, villageId: true, houseNumber: true, persons: { where: { villageId }, select: { id: true, firstName: true, lastName: true, nationalId: true, status: true } } } }, user: { select: { id: true, name: true, phoneNumber: true } } } });
  if (!request || (request.house && request.house.villageId !== villageId)) notFound();

  const [houses, nationalId, registration] = await Promise.all([
    prisma.house.findMany({ where: { villageId }, select: { id: true, houseNumber: true }, orderBy: { houseNumber: "asc" } }),
    getNationalIdForUser(prisma, request.user.id, villageId),
    prisma.registrationTemp.findFirst({ where: { userId: request.user.id, villageId, status: "VERIFIED" }, orderBy: { updatedAt: "desc" }, select: { dateOfBirth: true } }),
  ]);
  const identityReconciliation = await reconcileBindingPersonIdentity(prisma, { villageId, nationalId, applicantUserId: request.user.id });
  const identityForReview = identityReconciliation.kind === "single_unlinked_match" || identityReconciliation.kind === "multiple_matches" || identityReconciliation.kind === "linked_to_another_user"
    ? { kind: identityReconciliation.kind, ...(identityReconciliation.kind === "single_unlinked_match" || identityReconciliation.kind === "linked_to_another_user" ? { person: { name: `${identityReconciliation.person.firstName} ${identityReconciliation.person.lastName}`, nationalIdMasked: identityReconciliation.person.nationalId ? maskNationalId(identityReconciliation.person.nationalId) : "-", dateOfBirth: identityReconciliation.person.dateOfBirth?.toLocaleDateString("th-TH") ?? null, phone: identityReconciliation.person.phone, houseNumber: identityReconciliation.person.house?.houseNumber ?? null, source: identityReconciliation.person.house ? `${identityReconciliation.person.house.sourceType}${identityReconciliation.person.house.sourceNote ? `: ${identityReconciliation.person.house.sourceNote}` : ""}` : null } } : {}) }
    : undefined;
  const base = `/superadmin/villages/${villageId}/binding-requests`;
  const requestedHouseNumber = request.house?.houseNumber ?? request.houseNumber;

  return <div className="mx-auto max-w-5xl space-y-6">
    <header className="flex flex-wrap justify-between gap-3"><div><Link href={base} className="text-sm text-slate-500">← กลับรายการคำขอ</Link><h2 className="mt-2 text-2xl font-semibold">รายละเอียดคำขอผูกบ้าน</h2><p className="mt-1 text-sm text-slate-500">ส่งเมื่อ {request.createdAt.toLocaleString("th-TH")}</p></div><Badge variant={request.status === "APPROVED" ? "success" : request.status === "REJECTED" ? "danger" : "warning"}>{request.status}</Badge></header>
    <section className="grid gap-4 md:grid-cols-2"><div className="rounded-xl border bg-white p-5"><h3 className="font-semibold">ผู้ยื่นคำขอ</h3><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-slate-500">ชื่อ</dt><dd className="font-medium">{request.user.name}</dd></div><div><dt className="text-slate-500">เบอร์โทร</dt><dd>{maskPhone(request.user.phoneNumber)}</dd></div><div><dt className="text-slate-500">เลขบัตรประชาชน</dt><dd>{nationalId ? maskNationalId(nationalId) : "-"}</dd></div></dl></div><div className="rounded-xl border bg-white p-5"><h3 className="font-semibold">บ้านที่ขอ</h3><p className="mt-4 text-xl font-semibold">บ้านเลขที่ {requestedHouseNumber ?? "-"}</p><p className="mt-2 text-sm text-slate-500">{request.house ? "จับคู่กับทะเบียนบ้านแล้ว" : "ยังไม่ได้จับคู่กับทะเบียนบ้าน"}</p></div></section>
    {request.house ? <section className="rounded-xl border bg-white"><h3 className="border-b px-4 py-3 font-semibold">คนในบ้าน</h3><div className="divide-y">{request.house.persons.map((person) => <div key={person.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:justify-between"><span className="font-medium">{person.firstName} {person.lastName}</span><span className="text-slate-500">{person.nationalId ? maskNationalId(person.nationalId) : "-"} · {person.status}</span></div>)}{!request.house.persons.length ? <p className="p-8 text-center text-sm text-slate-500">ยังไม่มีคนในทะเบียนบ้าน</p> : null}</div></section> : null}
    <section className="rounded-xl border bg-white p-5"><h3 className="font-semibold">ประวัติการพิจารณา</h3><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">ตรวจเมื่อ</dt><dd>{request.reviewedAt?.toLocaleString("th-TH") ?? "ยังไม่ตรวจ"}</dd></div><div><dt className="text-slate-500">เหตุผล</dt><dd>{request.reviewNote ?? "-"}</dd></div></dl>{request.status === "PENDING" ? <BindingReviewForm villageName={request.village?.name ?? "หมู่บ้านนี้"} requestId={request.id} proposed={!request.houseId} houses={houses} reviewAction={reviewBindingForWorkspaceAction.bind(null, villageId)} identityReconciliation={identityForReview} applicantName={request.user.name} applicantPhone={request.user.phoneNumber} applicantDateOfBirth={registration?.dateOfBirth?.toLocaleDateString("th-TH") ?? null} requestedHouseNumber={requestedHouseNumber} /> : null}</section>
  </div>;
}

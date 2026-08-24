import Link from "next/link";
import { ContactRequestType } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { ContactRequestDecisionActions } from "../contact-request-decision-actions";

interface PageProps { params: Promise<{ requestId: string }> }
const statusCopy = { PENDING: "รอพิจารณา", APPROVED: "อนุมัติแล้ว", REJECTED: "ไม่อนุมัติ" };
const statusVariant = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" } as const;
const fields = [{ key: "name", label: "ชื่อ" }, { key: "role", label: "ตำแหน่ง" }, { key: "phone", label: "เบอร์โทร" }, { key: "email", label: "อีเมล" }, { key: "address", label: "ที่อยู่" }, { key: "category", label: "หมวดหมู่" }] as const;
const value = (input: string | null | undefined) => input || "ไม่ได้ระบุ";

export default async function AdminContactRequestDetailPage({ params }: PageProps) {
  const { requestId } = await params; const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login"); if (!isAdminUser(session)) redirect("/resident");
  const membership = await prisma.villageMembership.findFirst({ where: { userId: session.id, status: "ACTIVE", role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] } }, select: { villageId: true } });
  if (!membership) redirect("/resident");
  const request = await prisma.contactRequest.findFirst({ where: { id: requestId, villageId: membership.villageId }, include: { requester: { select: { name: true } }, targetContact: { select: { id: true, name: true, role: true, phone: true, email: true, address: true, category: true } } } });
  if (!request) notFound();
  const isUpdate = request.type === ContactRequestType.UPDATE;
  const target = request.targetContact;
  const changed = target ? fields.filter((field) => value(target[field.key]) !== value(request[field.key])) : [];
  const title = isUpdate ? "คำขอแก้ไขผู้ติดต่อ" : "คำขอเพิ่มผู้ติดต่อ";

  return <div className="mx-auto w-full max-w-3xl space-y-5">
    <Link href="/admin/contacts/requests" className="text-sm text-gray-500 hover:text-gray-700">← รายการคำขอผู้ติดต่อ</Link>
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-xl font-semibold text-gray-900">{title}</h1><p className="mt-2 text-sm text-gray-500">ส่งโดย: {request.requester.name}</p><p className="text-sm text-gray-500">ส่งเมื่อ: {request.createdAt.toLocaleString("th-TH")}</p></div><Badge variant={statusVariant[request.status]}>{statusCopy[request.status]}</Badge></div>
      {isUpdate ? <section className="mt-6 border-t border-gray-100 pt-5"><h2 className="font-semibold text-gray-900">เปรียบเทียบข้อมูล</h2>{target ? <><p className="mt-2 text-sm text-gray-600">ผู้ติดต่อปัจจุบัน: <Link href={`/admin/contacts/${target.id}`} className="font-medium text-green-700 hover:underline">{target.name}</Link></p>{changed.length ? <div className="mt-4 space-y-3">{changed.map((field) => <div key={field.key} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm"><p className="font-medium text-gray-900">{field.label}</p><p className="mt-1 text-gray-500">เดิม: {value(target[field.key])}</p><p className="mt-1 text-green-800">เสนอแก้เป็น: {value(request[field.key])}</p></div>)}</div> : <p className="mt-3 text-sm text-amber-700">ไม่พบข้อมูลที่ต่างจากข้อมูลปัจจุบัน</p>}</> : <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">ไม่พบผู้ติดต่อปลายทาง คำขอนี้ไม่สามารถอนุมัติได้</p>}</section> : <section className="mt-6 border-t border-gray-100 pt-5"><h2 className="font-semibold text-gray-900">ข้อมูลผู้ติดต่อที่เสนอ</h2><dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">{fields.map((field) => <div key={field.key}><dt className="text-gray-500">{field.label}</dt><dd className="mt-1 font-medium text-gray-900">{value(request[field.key])}</dd></div>)}</dl></section>}
      {request.note ? <div className="mt-6 border-t border-gray-100 pt-5"><h2 className="font-semibold text-gray-900">หมายเหตุจากผู้ขอ</h2><p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{request.note}</p></div> : null}
      {request.status === "PENDING" ? <ContactRequestDecisionActions requestId={request.id} contactName={request.name} requestType={request.type} /> : <div className="mt-6 border-t border-gray-100 pt-5 text-sm"><p className="font-medium text-gray-900">ผู้พิจารณา: {request.reviewedByName || "ไม่ได้ระบุ"}</p><p className="mt-1 text-gray-500">วันที่พิจารณา: {request.reviewedAt?.toLocaleString("th-TH") || "ไม่ได้ระบุ"}</p>{request.status === "APPROVED" ? <><p className="mt-4 text-gray-700">{isUpdate ? "การแก้ไขได้รับการอนุมัติแล้ว" : "ผู้ติดต่อถูกเพิ่มเข้ารายชื่อแล้ว"}</p>{request.approvedContactId ? <Link href={`/admin/contacts/${request.approvedContactId}`} className="mt-3 inline-flex font-medium text-green-700 hover:text-green-800">ดูข้อมูลผู้ติดต่อ</Link> : null}</> : <p className="mt-4 text-red-700">เหตุผล: {request.rejectReason || "ไม่ได้ระบุ"}</p>}</div>}
    </section>
  </div>;
}

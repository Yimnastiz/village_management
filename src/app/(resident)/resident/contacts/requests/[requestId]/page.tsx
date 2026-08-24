import Link from "next/link";
import { ContactRequestType } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { ResidentContactRequestModal } from "../../resident-contact-request-modal";
import { ResidentContactRequestCancelAction } from "../../resident-contact-request-cancel-action";

interface PageProps { params: Promise<{ requestId: string }> }
const statusCopy = { PENDING: "รอพิจารณา", APPROVED: "อนุมัติแล้ว", REJECTED: "ไม่อนุมัติ", CANCELLED: "ยกเลิกแล้ว" };
const statusVariant = { PENDING: "warning", APPROVED: "success", REJECTED: "danger", CANCELLED: "default" } as const;
const typeCopy = { CREATE: "คำขอเพิ่มผู้ติดต่อ", UPDATE: "คำขอแก้ไขผู้ติดต่อ", DELETE: "คำขอลบผู้ติดต่อ" } as const;
const fields = [{ key: "name", label: "ชื่อผู้ติดต่อ" }, { key: "role", label: "ตำแหน่ง" }, { key: "phone", label: "เบอร์โทร" }, { key: "email", label: "อีเมล" }, { key: "address", label: "ที่อยู่" }, { key: "category", label: "หมวดหมู่" }] as const;
const value = (input: string | null | undefined) => input || "ไม่ได้ระบุ";

export default async function ResidentContactRequestDetailPage({ params }: PageProps) {
  const { requestId } = await params; const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  const membership = getResidentMembership(session); if (!membership) redirect("/resident/dashboard");
  const request = await prisma.contactRequest.findFirst({ where: { id: requestId, requesterId: session.id, villageId: membership.villageId } });
  if (!request) notFound();
  const isUpdate = request.type === ContactRequestType.UPDATE;
  const isDelete = request.type === ContactRequestType.DELETE;
  const target = isUpdate && request.targetContactId ? await prisma.contactDirectory.findFirst({ where: { id: request.targetContactId, villageId: membership.villageId }, select: { id: true, name: true, role: true, phone: true, email: true, address: true, category: true } }) : null;
  const changed = target ? fields.filter((field) => value(target[field.key]) !== value(request[field.key])) : [];

  return <div className="mx-auto w-full max-w-3xl space-y-6">
    <Link href="/resident/contacts/requests" className="text-sm text-gray-500 hover:text-gray-700">← กลับรายการคำขอ</Link>
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-semibold text-gray-900">{typeCopy[request.type]}</h1><Badge variant={statusVariant[request.status]}>{statusCopy[request.status]}</Badge></div>
      <p className="mt-1 text-sm text-gray-500">ส่งเมื่อ {request.createdAt.toLocaleString("th-TH")}</p>
      {isDelete ? <section className="mt-5 space-y-4 border-t border-gray-100 pt-5"><div><h2 className="font-semibold text-gray-900">ผู้ติดต่อที่ขอลบ</h2><p className="mt-1 text-lg font-medium text-gray-900">{request.name}</p><p className="mt-1 text-sm text-gray-600">{request.role || "ไม่ได้ระบุตำแหน่ง"}{request.phone ? ` • ${request.phone}` : ""}</p></div><div><h2 className="font-semibold text-gray-900">เหตุผลในการลบ</h2><p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{request.deleteReason || "ไม่ได้ระบุ"}</p></div></section> : target ? <section className="mt-5"><h2 className="font-semibold text-gray-900">ข้อมูลที่เสนอแก้ไข</h2>{changed.length ? <div className="mt-3 space-y-3">{changed.map((field) => <div key={field.key} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm"><p className="font-medium text-gray-900">{field.label}</p><p className="mt-1 text-gray-500">เดิม: {value(target[field.key])}</p><p className="mt-1 text-green-800">เสนอแก้เป็น: {value(request[field.key])}</p></div>)}</div> : <p className="mt-2 text-sm text-gray-500">ไม่มีข้อมูลที่เปลี่ยนแปลง</p>}</section> : <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">{fields.map((field) => <div key={field.key}><dt className="text-gray-500">{field.label}</dt><dd className="font-medium text-gray-900">{value(request[field.key])}</dd></div>)}</dl>}
      {request.note && !isDelete ? <p className="mt-5 whitespace-pre-wrap text-sm text-gray-700">หมายเหตุ: {request.note}</p> : null}
      {request.status === "CANCELLED" ? <p className="mt-5 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">ยกเลิกคำขอแล้ว</p> : null}
      {request.status === "REJECTED" ? <p className="mt-5 text-sm text-red-700">เหตุผลที่ไม่อนุมัติ: {request.rejectReason || "ไม่ได้ระบุ"}</p> : null}
      {request.status === "APPROVED" && request.approvedContactId && !isDelete ? <Link href={`/resident/contacts/${request.approvedContactId}`} className="mt-5 inline-flex rounded-md border border-green-300 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50">ดูข้อมูลผู้ติดต่อ</Link> : null}
      {request.status === "PENDING" ? <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4">{!isDelete ? <ResidentContactRequestModal mode="edit-request" requestId={request.id} initialValues={{ name: request.name, role: request.role, phone: request.phone, email: request.email, address: request.address, category: request.category, note: request.note }} fullLabel /> : null}<ResidentContactRequestCancelAction requestId={request.id} requestType={request.type} /></div> : null}
    </div>
  </div>;
}

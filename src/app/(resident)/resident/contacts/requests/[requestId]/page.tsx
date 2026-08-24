import Link from "next/link";
import { ContactRequestType } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { ResidentContactRequestModal } from "../../resident-contact-request-modal";

interface PageProps { params: Promise<{ requestId: string }> }
const statusCopy = { PENDING: "รอพิจารณา", APPROVED: "อนุมัติแล้ว", REJECTED: "ไม่อนุมัติ" };
const statusVariant = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" } as const;
const fields = [{ key: "name", label: "ชื่อผู้ติดต่อ" }, { key: "role", label: "ตำแหน่ง" }, { key: "phone", label: "เบอร์โทร" }, { key: "email", label: "อีเมล" }, { key: "address", label: "ที่อยู่" }, { key: "category", label: "หมวดหมู่" }] as const;
const value = (input: string | null | undefined) => input || "ไม่ได้ระบุ";

export default async function ResidentContactRequestDetailPage({ params }: PageProps) {
  const { requestId } = await params; const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  const membership = getResidentMembership(session); if (!membership) redirect("/resident/dashboard");
  const request = await prisma.contactRequest.findFirst({ where: { id: requestId, requesterId: session.id, villageId: membership.villageId } });
  if (!request) notFound();
  const target = request.type === ContactRequestType.UPDATE && request.targetContactId ? await prisma.contactDirectory.findFirst({ where: { id: request.targetContactId, villageId: membership.villageId }, select: { id: true, name: true, role: true, phone: true, email: true, address: true, category: true } }) : null;
  const changed = target ? fields.filter((field) => value(target[field.key]) !== value(request[field.key])) : [];
  const title = request.type === ContactRequestType.UPDATE ? "คำขอแก้ไขผู้ติดต่อ" : "คำขอเพิ่มผู้ติดต่อ";

  return <div className="mx-auto w-full max-w-3xl space-y-6">
    <Link href="/resident/contacts/requests" className="text-sm text-gray-500 hover:text-gray-700">← กลับรายการคำขอ</Link>
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-semibold text-gray-900">{title}</h1><Badge variant={statusVariant[request.status]}>{statusCopy[request.status]}</Badge></div>
      <p className="mt-1 text-sm text-gray-500">ส่งเมื่อ {request.createdAt.toLocaleString("th-TH")}</p>
      {target ? <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">แก้ไขข้อมูลของ: <Link href={`/resident/contacts/${target.id}`} className="font-medium text-green-700 hover:underline">{target.name}</Link></p> : null}
      {target ? <section className="mt-5"><h2 className="font-semibold text-gray-900">ข้อมูลที่เสนอแก้ไข</h2>{changed.length ? <div className="mt-3 space-y-3">{changed.map((field) => <div key={field.key} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm"><p className="font-medium text-gray-900">{field.label}</p><p className="mt-1 text-gray-500">เดิม: {value(target[field.key])}</p><p className="mt-1 text-green-800">เสนอแก้เป็น: {value(request[field.key])}</p></div>)}</div> : <p className="mt-2 text-sm text-gray-500">ไม่มีข้อมูลที่เปลี่ยนแปลง</p>}</section> : <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">{fields.map((field) => <div key={field.key}><dt className="text-gray-500">{field.label}</dt><dd className="font-medium text-gray-900">{value(request[field.key])}</dd></div>)}</dl>}
      {request.note ? <p className="mt-5 whitespace-pre-wrap text-sm text-gray-700">หมายเหตุ: {request.note}</p> : null}
      {request.reviewedByName ? <p className="mt-5 text-sm text-gray-600">ผู้พิจารณา: {request.reviewedByName}</p> : null}
      {request.status === "REJECTED" ? <p className="mt-2 text-sm text-red-700">เหตุผลที่ไม่อนุมัติ: {request.rejectReason || "ไม่ได้ระบุ"}</p> : null}
      {request.status === "APPROVED" && request.approvedContactId ? <Link href={`/resident/contacts/${request.approvedContactId}`} className="mt-5 inline-flex rounded-md border border-green-300 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50">ดูข้อมูลผู้ติดต่อ</Link> : null}
      {request.status === "REJECTED" ? <Link href="/resident/contacts/requests?new=1" className="mt-5 inline-flex rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">ส่งคำขอใหม่</Link> : null}
      {request.status === "PENDING" ? <div className="mt-5 border-t border-gray-100 pt-4"><ResidentContactRequestModal mode="edit-request" requestId={request.id} initialValues={{ name: request.name, role: request.role, phone: request.phone, email: request.email, address: request.address, category: request.category, note: request.note }} fullLabel /></div> : null}
    </div>
  </div>;
}

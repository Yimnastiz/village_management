import Link from "next/link";
import { ContactRequestType } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { ContactRequestDecisionActions } from "../contact-request-decision-actions";

interface PageProps { params: Promise<{ requestId: string }>; searchParams?: Promise<{ tab?: string }> }
const statusCopy = { PENDING: "รอพิจารณา", APPROVED: "อนุมัติแล้ว", REJECTED: "ไม่อนุมัติ", CANCELLED: "ยกเลิกแล้ว" };
const statusVariant = { PENDING: "warning", APPROVED: "success", REJECTED: "danger", CANCELLED: "default" } as const;
const typeCopy = { CREATE: "คำขอเพิ่มผู้ติดต่อ", UPDATE: "คำขอแก้ไขผู้ติดต่อ", DELETE: "คำขอลบผู้ติดต่อ" } as const;
const fields = [{ key: "name", label: "ชื่อ" }, { key: "role", label: "ตำแหน่ง" }, { key: "phone", label: "เบอร์โทร" }, { key: "email", label: "อีเมล" }, { key: "address", label: "ที่อยู่" }, { key: "category", label: "หมวดหมู่" }] as const;
const value = (input: string | null | undefined) => input || "ไม่ได้ระบุ";

export default async function AdminContactRequestDetailPage({ params, searchParams }: PageProps) {
  const { requestId } = await params; const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login"); if (!isAdminUser(session)) redirect("/resident");
  const membership = await prisma.villageMembership.findFirst({ where: { userId: session.id, status: "ACTIVE", role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] } }, select: { villageId: true } });
  if (!membership) redirect("/resident");
  const request = await prisma.contactRequest.findFirst({ where: { id: requestId, villageId: membership.villageId }, include: { requester: { select: { name: true } }, targetContact: { select: { id: true, name: true, role: true, phone: true, email: true, address: true, category: true } } } });
  if (!request) notFound();
  const isUpdate = request.type === ContactRequestType.UPDATE;
  const isDelete = request.type === ContactRequestType.DELETE;
  const target = request.targetContact;
  const changed = target ? fields.filter((field) => value(target[field.key]) !== value(request[field.key])) : [];
  const backHref = (await searchParams)?.tab === "history" ? "/admin/contacts/requests?tab=history" : "/admin/contacts/requests";

  return <div data-admin-compact-top className="space-y-3"><AdminPageToolbar title="รายละเอียดคำขอข้อมูลติดต่อ" variant="request" actions={<Link href={backHref} className="inline-flex min-h-10 items-center text-sm font-medium text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">← กลับรายการคำขอ</Link>} /><div className="mx-auto w-full max-w-3xl"><section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-xl font-semibold text-gray-900">{typeCopy[request.type]}</h1><p className="mt-2 text-sm text-gray-500">ส่งโดย: {request.requester.name}</p><p className="text-sm text-gray-500">ส่งเมื่อ: {request.createdAt.toLocaleString("th-TH")}</p></div><Badge variant={statusVariant[request.status]}>{statusCopy[request.status]}</Badge></div>
      {isDelete ? <section className="mt-6 space-y-5 border-t border-gray-100 pt-5"><div><h2 className="font-semibold text-gray-900">ผู้ติดต่อที่ขอลบ</h2><p className="mt-2 text-lg font-medium text-gray-900">{request.name}</p><p className="mt-1 text-sm text-gray-600">{request.role || "ไม่ได้ระบุตำแหน่ง"}{request.phone ? ` • ${request.phone}` : ""}</p>{target ? <Link href={`/admin/contacts/${target.id}`} className="mt-2 inline-flex text-sm font-medium text-green-700 hover:underline">ดูข้อมูลผู้ติดต่อปัจจุบัน</Link> : <p className="mt-2 text-sm text-gray-500">ข้อมูลผู้ติดต่อปัจจุบันไม่อยู่ในรายการแล้ว</p>}</div><div><h2 className="font-semibold text-gray-900">เหตุผลในการลบ</h2><p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{request.deleteReason || "ไม่ได้ระบุ"}</p></div></section> : isUpdate ? <section className="mt-6 border-t border-gray-100 pt-5"><h2 className="font-semibold text-gray-900">เปรียบเทียบข้อมูล</h2>{target ? <><p className="mt-2 text-sm text-gray-600">ผู้ติดต่อปัจจุบัน: <Link href={`/admin/contacts/${target.id}`} className="font-medium text-green-700 hover:underline">{target.name}</Link></p>{changed.length ? <div className="mt-4 space-y-3">{changed.map((field) => <div key={field.key} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm"><p className="font-medium text-gray-900">{field.label}</p><p className="mt-1 text-gray-500">เดิม: {value(target[field.key])}</p><p className="mt-1 text-green-800">เสนอแก้เป็น: {value(request[field.key])}</p></div>)}</div> : <p className="mt-3 text-sm text-amber-700">ไม่พบข้อมูลที่ต่างจากข้อมูลปัจจุบัน</p>}</> : <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">ไม่พบผู้ติดต่อปลายทาง คำขอนี้ไม่สามารถอนุมัติได้</p>}</section> : <section className="mt-6 border-t border-gray-100 pt-5"><h2 className="font-semibold text-gray-900">ข้อมูลผู้ติดต่อที่เสนอ</h2><dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">{fields.map((field) => <div key={field.key}><dt className="text-gray-500">{field.label}</dt><dd className="mt-1 font-medium text-gray-900">{value(request[field.key])}</dd></div>)}</dl></section>}
      {request.note && !isDelete ? <div className="mt-6 border-t border-gray-100 pt-5"><h2 className="font-semibold text-gray-900">หมายเหตุจากผู้ขอ</h2><p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{request.note}</p></div> : null}
      {request.status === "PENDING" ? <ContactRequestDecisionActions requestId={request.id} contactName={request.name} requestType={request.type} /> : <div className="mt-6 border-t border-gray-100 pt-5 text-sm">{request.status === "CANCELLED" ? <p className="rounded-lg bg-gray-50 px-3 py-2 text-gray-600">ผู้ขอยกเลิกคำขอแล้ว</p> : <><p className="font-medium text-gray-900">ผู้พิจารณา: {request.reviewedByName || "ไม่ได้ระบุ"}</p><p className="mt-1 text-gray-500">วันที่พิจารณา: {request.reviewedAt?.toLocaleString("th-TH") || "ไม่ได้ระบุ"}</p>{request.status === "APPROVED" ? <p className="mt-4 text-gray-700">{isDelete ? "ผู้ติดต่อถูกนำออกจากรายการแล้ว" : isUpdate ? "การแก้ไขได้รับการอนุมัติแล้ว" : "ผู้ติดต่อถูกเพิ่มเข้ารายชื่อแล้ว"}</p> : <p className="mt-4 text-red-700">เหตุผล: {request.rejectReason || "ไม่ได้ระบุ"}</p>}</>}</div>}
    </section></div></div>;
}

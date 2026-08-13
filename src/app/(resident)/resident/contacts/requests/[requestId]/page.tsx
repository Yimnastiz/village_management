import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

interface PageProps { params: Promise<{ requestId: string }> }
const statusCopy = { PENDING: "รอพิจารณา", APPROVED: "อนุมัติแล้ว", REJECTED: "ไม่อนุมัติ" };
const statusVariant = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" } as const;
const value = (input: string | null) => input || "ไม่ได้ระบุ";

export default async function ResidentContactRequestDetailPage({ params }: PageProps) {
  const { requestId } = await params; const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login"); const membership = getResidentMembership(session); if (!membership) redirect("/resident/dashboard");
  const request = await prisma.contactRequest.findFirst({ where: { id: requestId, requesterId: session.id, villageId: membership.villageId } }); if (!request) notFound();
  const fields = [["ชื่อผู้ติดต่อ", request.name], ["เบอร์โทร", request.phone], ["ตำแหน่ง", value(request.role)], ["อีเมล", value(request.email)], ["ที่อยู่", value(request.address)], ["หมวดหมู่", value(request.category)]];
  return <div className="mx-auto w-full max-w-3xl space-y-6"><Link href="/resident/contacts/requests" className="text-sm text-gray-500 hover:text-gray-700">← กลับรายการคำขอ</Link><div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-semibold text-gray-900">คำขอเพิ่มผู้ติดต่อ</h1><Badge variant={statusVariant[request.status]}>{statusCopy[request.status]}</Badge></div><p className="mt-1 text-sm text-gray-500">ส่งเมื่อ {request.createdAt.toLocaleString("th-TH")}</p><dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">{fields.map(([label, fieldValue]) => <div key={label}><dt className="text-gray-500">{label}</dt><dd className="font-medium text-gray-900">{fieldValue}</dd></div>)}</dl>{request.note ? <p className="mt-5 whitespace-pre-wrap text-sm text-gray-700">หมายเหตุ: {request.note}</p> : null}{request.reviewedByName ? <p className="mt-5 text-sm text-gray-600">ผู้พิจารณา: {request.reviewedByName}</p> : null}{request.status === "REJECTED" ? <p className="mt-2 text-sm text-red-700">เหตุผลที่ไม่อนุมัติ: {request.rejectReason || "ไม่ได้ระบุ"}</p> : null}{request.status === "APPROVED" && request.approvedContactId ? <Link href={`/resident/contacts/${request.approvedContactId}`} className="mt-5 inline-flex rounded-md border border-green-300 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50">ดูข้อมูลผู้ติดต่อที่อนุมัติแล้ว</Link> : null}{request.status === "REJECTED" ? <Link href="/resident/contacts/new" className="mt-5 inline-flex rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">ส่งคำขอใหม่</Link> : null}</div></div>;
}

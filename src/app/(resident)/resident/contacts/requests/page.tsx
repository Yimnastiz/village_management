import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

const statusCopy = { PENDING: "รอพิจารณา", APPROVED: "อนุมัติแล้ว", REJECTED: "ไม่อนุมัติ" };
const statusVariant = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" } as const;

export default async function ResidentContactRequestsPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");
  const rows = await prisma.contactRequest.findMany({ where: { requesterId: session.id, villageId: membership.villageId }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, phone: true, status: true, createdAt: true } });
  return <div className="space-y-6"><div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-gray-900">สถานะคำขอผู้ติดต่อของฉัน</h1><p className="mt-1 text-sm text-gray-500">ติดตามผลการพิจารณาคำขอที่คุณส่ง</p></div><Link href="/resident/contacts/new" className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700">ส่งคำขอใหม่</Link></div><div className="space-y-3">{rows.length === 0 ? <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">ยังไม่มีคำขอ</div> : rows.map((request) => <Link key={request.id} href={`/resident/contacts/requests/${request.id}`} className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-green-300 hover:bg-green-50/40"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-gray-900">{request.name}</p><Badge variant={statusVariant[request.status]}>{statusCopy[request.status]}</Badge></div><p className="mt-1 text-sm text-gray-600">{request.phone}</p><p className="mt-1 text-xs text-gray-400">ส่งเมื่อ {request.createdAt.toLocaleString("th-TH")}</p></Link>)}</div></div>;
}

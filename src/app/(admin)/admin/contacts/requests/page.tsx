import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

type PageProps = { searchParams?: Promise<{ tab?: string }> };
const statusCopy = { PENDING: "รอพิจารณา", APPROVED: "อนุมัติแล้ว", REJECTED: "ไม่อนุมัติ" };
const statusVariant = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" } as const;

export default async function AdminContactRequestsPage({ searchParams }: PageProps) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");
  const membership = await prisma.villageMembership.findFirst({ where: { userId: session.id, status: "ACTIVE", role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] } }, select: { villageId: true } });
  if (!membership) redirect("/resident");

  const params = (await searchParams) ?? {};
  const history = params.tab === "history";
  const [pendingCount, rows] = await Promise.all([
    prisma.contactRequest.count({ where: { villageId: membership.villageId, status: "PENDING" } }),
    prisma.contactRequest.findMany({
      where: { villageId: membership.villageId, status: history ? { in: ["APPROVED", "REJECTED"] } : "PENDING" },
      orderBy: history ? { reviewedAt: "desc" } : { createdAt: "desc" },
      select: { id: true, name: true, role: true, phone: true, status: true, createdAt: true, reviewedAt: true, reviewedByName: true, rejectReason: true, requester: { select: { name: true } } },
    }),
  ]);

  return <div data-admin-compact-top className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><h1 className="text-2xl font-bold text-gray-900">คำขอเพิ่มผู้ติดต่อ</h1><p className="mt-1 text-sm text-gray-500">ตรวจสอบคำขอจากลูกบ้านก่อนเพิ่มเข้ารายชื่อผู้ติดต่อ</p></div>
      <Link href="/admin/contacts"><Button variant="outline" size="sm" className="w-full sm:w-auto">กลับรายชื่อผู้ติดต่อ</Button></Link>
    </div>
    <nav aria-label="ตัวกรองคำขอ" className="flex border-b border-gray-200">
      <Link href="/admin/contacts/requests" className={`border-b-2 px-4 py-2 text-sm font-medium ${!history ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>รอพิจารณา ({pendingCount})</Link>
      <Link href="/admin/contacts/requests?tab=history" className={`border-b-2 px-4 py-2 text-sm font-medium ${history ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>ประวัติ</Link>
    </nav>
    {rows.length === 0 ? <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">{history ? "ยังไม่มีประวัติการพิจารณา" : "ไม่มีคำขอที่รอพิจารณา"}</div> :
      <div className="space-y-2">{rows.map((request) => <Link key={request.id} href={`/admin/contacts/requests/${request.id}`} className="block rounded-xl border border-gray-200 bg-white p-4 transition hover:border-green-300 hover:bg-green-50/30 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="font-semibold text-gray-900">{request.name}</p><p className="mt-0.5 text-sm text-gray-600">{request.role || "ไม่ได้ระบุตำแหน่ง"} <span aria-hidden="true">•</span> {request.phone}</p></div><Badge variant={statusVariant[request.status]}>{statusCopy[request.status]}</Badge></div>
        {history ? <div className="mt-3 text-sm text-gray-500"><p>ผู้พิจารณา: {request.reviewedByName || "ไม่ได้ระบุ"}</p><p>พิจารณาเมื่อ: {request.reviewedAt?.toLocaleString("th-TH") || "ไม่ได้ระบุ"}</p>{request.status === "REJECTED" && request.rejectReason ? <p className="mt-1 text-red-700">เหตุผล: {request.rejectReason}</p> : null}</div> : <p className="mt-3 text-sm text-gray-500">ผู้ขอ: {request.requester.name} <span aria-hidden="true">•</span> ส่งเมื่อ: {request.createdAt.toLocaleString("th-TH")}</p>}
      </Link>)}</div>}
  </div>;
}

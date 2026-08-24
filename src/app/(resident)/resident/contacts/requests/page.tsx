import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ResidentPageToolbar } from "@/components/resident/resident-page-toolbar";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { ResidentContactRequestModal } from "../resident-contact-request-modal";

const statusCopy = { PENDING: "รอพิจารณา", APPROVED: "อนุมัติแล้ว", REJECTED: "ไม่อนุมัติ" };
const statusVariant = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" } as const;

export default async function ResidentContactRequestsPage({ searchParams }: { searchParams?: Promise<{ new?: string }> }) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");

  const query = await searchParams;
  const rows = await prisma.contactRequest.findMany({
    where: { requesterId: session.id, villageId: membership.villageId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, phone: true, status: true, createdAt: true },
  });

  return <div className="space-y-4">
    <ResidentPageToolbar
      namespace="resident-contact-requests"
      title="คำขอผู้ติดต่อ"
      actions={<div className="flex w-full flex-wrap items-center justify-between gap-2">
        <Link href="/resident/contacts" className="inline-flex min-h-10 items-center gap-1.5 px-1 text-sm font-medium text-gray-600 hover:text-gray-900"><ArrowLeft className="h-4 w-4" />กลับรายชื่อผู้ติดต่อ</Link>
        <ResidentContactRequestModal defaultOpen={query?.new === "1"} fullLabel />
      </div>}
    />
    <div className="space-y-3">
      {rows.length === 0 ? <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">ยังไม่มีคำขอ</div> : rows.map((request) => <Link key={request.id} href={`/resident/contacts/requests/${request.id}`} className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-green-300 hover:bg-green-50/40"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-gray-900">{request.name}</p><Badge variant={statusVariant[request.status]}>{statusCopy[request.status]}</Badge></div><p className="mt-1 text-sm text-gray-600">{request.phone}</p><p className="mt-1 text-xs text-gray-400">ส่งเมื่อ {request.createdAt.toLocaleString("th-TH")}</p></Link>)}
    </div>
  </div>;
}

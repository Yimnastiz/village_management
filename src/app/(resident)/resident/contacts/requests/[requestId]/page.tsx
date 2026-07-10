import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{ requestId: string }>;
}

export default async function ResidentContactRequestDetailPage({ params }: PageProps) {
  const { requestId } = await params;
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");

  const row = await prisma.notification.findFirst({
    where: {
      userId: session.id,
      metadata: {
        path: ["source"],
        equals: "RESIDENT_CONTACT_REQUEST_TRACKING",
      },
      AND: [
        {
          metadata: {
            path: ["requestId"],
            equals: requestId,
          },
        },
      ],
    },
    select: {
      title: true,
      body: true,
      createdAt: true,
      metadata: true,
    },
  });

  if (!row) notFound();

  const metadata = row.metadata as Record<string, unknown> | null;
  const payload = (metadata?.payload ?? {}) as Record<string, unknown>;
  const workflowStatus = typeof metadata?.workflowStatus === "string" ? metadata.workflowStatus : "PENDING";
  const reviewedByName = typeof metadata?.reviewedByName === "string" ? metadata.reviewedByName : null;
  const rejectReason = typeof metadata?.rejectReason === "string" ? metadata.rejectReason : null;
  const approvedContactId = typeof metadata?.approvedContactId === "string" ? metadata.approvedContactId : null;

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/resident/contacts/requests" className="text-sm text-gray-500 hover:text-gray-700">← กลับรายการคำขอ</Link>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-gray-900">{row.title}</h1>
          <Badge variant={workflowStatus === "APPROVED" ? "success" : workflowStatus === "REJECTED" ? "danger" : "warning"}>
            {workflowStatus}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-gray-500">ส่งเมื่อ {row.createdAt.toLocaleString("th-TH")}</p>
        <p className="mt-3 text-sm text-gray-700">{row.body || "-"}</p>

        <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <p>ชื่อผู้ติดต่อ: <span className="font-medium text-gray-900">{String(payload.name ?? "-")}</span></p>
          <p>เบอร์โทร: <span className="font-medium text-gray-900">{String(payload.phone ?? "-")}</span></p>
          <p>ตำแหน่ง: <span className="font-medium text-gray-900">{String(payload.role ?? "-")}</span></p>
          <p>อีเมล: <span className="font-medium text-gray-900">{String(payload.email ?? "-")}</span></p>
          <p className="sm:col-span-2">ที่อยู่: <span className="font-medium text-gray-900">{String(payload.address ?? "-")}</span></p>
          <p className="sm:col-span-2">หมายเหตุ: <span className="font-medium text-gray-900">{String(payload.note ?? "-")}</span></p>
        </div>

        {reviewedByName ? <p className="mt-4 text-sm text-gray-600">ผู้พิจารณา: {reviewedByName}</p> : null}
        {rejectReason ? <p className="mt-1 text-sm text-red-600">เหตุผลที่ไม่อนุมัติ: {rejectReason}</p> : null}

        {approvedContactId ? (
          <Link href={`/resident/contacts/${approvedContactId}`} className="mt-4 inline-flex rounded-md border border-green-300 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50">
            ดูข้อมูลผู้ติดต่อที่อนุมัติแล้ว
          </Link>
        ) : null}
      </div>
    </div>
  );
}

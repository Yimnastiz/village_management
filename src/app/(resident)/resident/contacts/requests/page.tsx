import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

export default async function ResidentContactRequestsPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");

  const rows = await prisma.notification.findMany({
    where: {
      userId: session.id,
      metadata: {
        path: ["source"],
        equals: "RESIDENT_CONTACT_REQUEST_TRACKING",
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      body: true,
      createdAt: true,
      metadata: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">สถานะคำขอผู้ติดต่อของฉัน</h1>
          <p className="mt-1 text-sm text-gray-500">ติดตามผลการพิจารณาคำขอที่คุณส่ง</p>
        </div>
        <Link href="/resident/contacts/new" className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700">
          ส่งคำขอใหม่
        </Link>
      </div>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">ยังไม่มีคำขอ</div>
        ) : (
          rows.map((row) => {
            const metadata = row.metadata as Record<string, unknown> | null;
            const requestId = typeof metadata?.requestId === "string" ? metadata.requestId : row.id;
            const workflowStatus = typeof metadata?.workflowStatus === "string" ? metadata.workflowStatus : "PENDING";

            return (
              <Link key={row.id} href={`/resident/contacts/requests/${requestId}`} className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-green-300 hover:bg-green-50/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-gray-900">{row.title}</p>
                  <Badge variant={workflowStatus === "APPROVED" ? "success" : workflowStatus === "REJECTED" ? "danger" : "warning"}>
                    {workflowStatus}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-gray-600">{row.body || "-"}</p>
                <p className="mt-1 text-xs text-gray-400">{row.createdAt.toLocaleString("th-TH")}</p>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

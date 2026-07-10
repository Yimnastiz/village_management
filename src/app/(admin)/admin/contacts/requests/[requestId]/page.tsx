import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { approveResidentContactRequestAction, rejectResidentContactRequestAction } from "../actions";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{ requestId: string }>;
}

export default async function AdminContactRequestDetailPage({ params }: PageProps) {
  const { requestId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const row = await prisma.notification.findFirst({
    where: {
      userId: session.id,
      metadata: {
        path: ["source"],
        equals: "RESIDENT_CONTACT_REQUEST_REVIEW",
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
      id: true,
      title: true,
      body: true,
      status: true,
      createdAt: true,
      metadata: true,
    },
  });

  if (!row) notFound();

  const metadata = row.metadata as Record<string, unknown> | null;
  const payload = (metadata?.payload ?? {}) as Record<string, unknown>;

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/contacts/requests" className="text-sm text-gray-500 hover:text-gray-700">← กลับรายการคำขอ</Link>

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-gray-900">{row.title}</h1>
          <Badge variant={row.status === "UNREAD" ? "warning" : "default"}>{row.status}</Badge>
        </div>
        <p className="text-sm text-gray-500">ส่งเมื่อ {row.createdAt.toLocaleString("th-TH")}</p>
        <p className="text-sm text-gray-700">{row.body || "-"}</p>

        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <p>ชื่อผู้ติดต่อ: <span className="font-medium text-gray-900">{String(payload.name ?? "-")}</span></p>
          <p>เบอร์โทร: <span className="font-medium text-gray-900">{String(payload.phone ?? "-")}</span></p>
          <p>ตำแหน่ง: <span className="font-medium text-gray-900">{String(payload.role ?? "-")}</span></p>
          <p>อีเมล: <span className="font-medium text-gray-900">{String(payload.email ?? "-")}</span></p>
          <p className="sm:col-span-2">ที่อยู่: <span className="font-medium text-gray-900">{String(payload.address ?? "-")}</span></p>
          <p className="sm:col-span-2">หมวดหมู่: <span className="font-medium text-gray-900">{String(payload.category ?? "-")}</span></p>
          <p className="sm:col-span-2">หมายเหตุ: <span className="font-medium text-gray-900">{String(payload.note ?? "-")}</span></p>
        </div>

        <div className="flex flex-wrap items-end gap-2 pt-2">
          <form action={approveResidentContactRequestAction}>
            <input type="hidden" name="notificationId" value={row.id} />
            <button type="submit" className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700">
              อนุมัติและเพิ่มเข้ารายชื่อผู้ติดต่อ
            </button>
          </form>

          <form action={rejectResidentContactRequestAction} className="flex items-end gap-2">
            <input type="hidden" name="notificationId" value={row.id} />
            <input
              type="text"
              name="reason"
              placeholder="เหตุผล (ไม่บังคับ)"
              className="h-9 rounded-md border border-gray-300 px-3 text-sm"
            />
            <button type="submit" className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
              ไม่อนุมัติ
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

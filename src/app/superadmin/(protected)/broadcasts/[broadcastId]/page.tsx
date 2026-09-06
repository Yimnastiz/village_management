import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { BroadcastDetailActions } from "../broadcast-detail-actions";

const statusLabels = { ACTIVE: "กำลังแสดง", EXPIRED: "หมดอายุแล้ว", CANCELLED: "ยกเลิกแล้ว" } as const;
const statusVariants = { ACTIVE: "success", EXPIRED: "warning", CANCELLED: "default" } as const;

function formatDate(value: Date) {
  return value.toLocaleString("th-TH");
}

export default async function SuperAdminBroadcastDetailPage({ params }: { params: Promise<{ broadcastId: string }> }) {
  await requireSuperAdminPageSession();
  const { broadcastId } = await params;
  const broadcast = await prisma.systemBroadcast.findUnique({
    where: { id: broadcastId },
    include: { createdBy: { select: { name: true } } },
  });

  if (!broadcast) notFound();

  const now = new Date();
  const status = broadcast.status === "CANCELLED" ? "CANCELLED" : broadcast.expiresAt && broadcast.expiresAt <= now ? "EXPIRED" : "ACTIVE";
  const canEdit = status === "ACTIVE";

  return (
    <div className="-mt-4 space-y-5 sm:-mt-6">
      <SuperAdminPageHeaderRegistration context={{ title: broadcast.title || "รายละเอียดประกาศ", description: "ตรวจสอบรายละเอียดและสถานะของประกาศส่วนกลาง" }} />
      <BroadcastDetailActions broadcast={{ id: broadcast.id, title: broadcast.title, body: broadcast.body, expiresAt: broadcast.expiresAt?.toISOString() ?? null }} canEdit={canEdit} />

      <article className="mx-auto w-full max-w-4xl space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <header className="space-y-3">
          <Badge variant={statusVariants[status]}>{statusLabels[status]}</Badge>
          <h1 className="break-words text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">{broadcast.title}</h1>
        </header>

        <section className="space-y-3 border-t border-slate-100 pt-5">
          <h2 className="text-lg font-semibold text-slate-900">รายละเอียดประกาศ</h2>
          <p className="whitespace-pre-wrap break-words leading-7 text-slate-700">{broadcast.body}</p>
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-5">
          <h2 className="text-lg font-semibold text-slate-900">ข้อมูลการเผยแพร่</h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">ส่งเมื่อ</dt><dd className="mt-1 font-medium text-slate-800">{formatDate(broadcast.createdAt)}</dd></div>
            <div><dt className="text-slate-500">หมดอายุ</dt><dd className="mt-1 font-medium text-slate-800">{broadcast.expiresAt ? formatDate(broadcast.expiresAt) : "ไม่กำหนดวันหมดอายุ"}</dd></div>
            <div><dt className="text-slate-500">ผู้รับ</dt><dd className="mt-1 font-medium text-slate-800">{broadcast.audienceCount.toLocaleString("th-TH")} คน</dd></div>
            <div><dt className="text-slate-500">ประกาศโดย</dt><dd className="mt-1 font-medium text-slate-800">{broadcast.createdBy?.name || "ผู้ดูแลระบบระดับสูง"}</dd></div>
          </dl>
        </section>
      </article>
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

export default async function VillageBindingRequestsPage({ params }: { params: Promise<{ villageId: string }> }) {
  await requireSuperAdminPageSession(); const { villageId } = await params;
  const rows = await prisma.bindingRequest.findMany({ where: { villageId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, status: true, houseNumber: true, reviewNote: true, createdAt: true, reviewedAt: true, reviewedBy: true, user: { select: { name: true } } } });
  const reviewerIds = rows.flatMap((row) => row.reviewedBy ? [row.reviewedBy] : []);
  const reviewers = await prisma.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, name: true } });
  const reviewerNames = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer.name]));
  return <section className="rounded-xl border bg-white p-4"><h2 className="text-lg font-semibold">คำขอผูกบ้าน</h2><div className="mt-3 grid gap-2">{rows.map((row) => <div key={row.id} className="rounded-lg border p-3 text-sm"><p className="font-medium">{row.user.name} · บ้าน {row.houseNumber ?? "-"} · {row.status}</p><p className="text-slate-500">ส่ง {row.createdAt.toLocaleString("th-TH")} · ผู้ตรวจ {row.reviewedBy ? reviewerNames.get(row.reviewedBy) ?? "ผู้ตรวจ" : "-"} · {row.reviewedAt?.toLocaleString("th-TH") ?? "-"}</p>{row.reviewNote ? <p className="mt-1 text-xs text-amber-700">เหตุผล: {row.reviewNote}</p> : null}</div>)}</div></section>;
}

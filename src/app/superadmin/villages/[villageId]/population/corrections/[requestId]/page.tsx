import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { CorrectionReviewForm } from "../../../correction-review-form";
import { reviewCorrectionForWorkspaceAction } from "../../../correction-actions";

export default async function Page({ params }: { params: Promise<{ villageId: string; requestId: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId, requestId } = await params;
  const row = await prisma.householdCorrectionRequest.findFirst({ where: { id: requestId, villageId }, include: { house: { select: { id: true, villageId: true, houseNumber: true, address: true } } } });
  if (!row || (row.house && row.house.villageId !== villageId)) notFound();
  const base = `/superadmin/villages/${villageId}/population/corrections`;
  return <div className="mx-auto max-w-4xl space-y-5"><header><Link href={base} className="text-sm text-slate-500">← กลับรายการคำขอ</Link><div className="mt-2 flex flex-wrap justify-between gap-3"><div><h2 className="text-2xl font-semibold">{row.subject}</h2><p className="mt-1 text-sm text-slate-500">ส่งเมื่อ {row.createdAt.toLocaleString("th-TH")}</p></div><Badge variant={row.status === "APPROVED" ? "success" : row.status === "REJECTED" ? "danger" : "warning"}>{row.status}</Badge></div></header><section className="rounded-xl border bg-white p-5"><h3 className="font-semibold">รายละเอียดที่ขอแก้ไข</h3><p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{row.description}</p><dl className="mt-5 grid gap-3 border-t pt-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">บ้าน</dt><dd>{row.house?.villageId === villageId ? row.house.houseNumber : "-"}</dd></div><div><dt className="text-slate-500">ผลการพิจารณา</dt><dd>{row.reviewNote ?? "-"}</dd></div></dl>{row.status === "PENDING" ? <CorrectionReviewForm villageId={villageId} requestId={requestId} reviewAction={reviewCorrectionForWorkspaceAction.bind(null, villageId)} /> : null}</section></div>;
}

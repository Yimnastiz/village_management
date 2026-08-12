import Link from "next/link";
import { PopulationImportStage } from "@prisma/client";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ImportConfirmForm } from "@/app/(admin)/admin/population/import/[jobId]/import-confirm-form";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { confirmWorkspaceImportAction } from "../actions";

type Detail = { rowDetails?: Array<{ rowNumber: number; action?: string; status?: string; errorMessage?: string }> };
export default async function Page({ params }: { params: Promise<{ villageId: string; jobId: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId, jobId } = await params;
  const job = await prisma.populationImportJob.findFirst({ where: { id: jobId, villageId } });
  if (!job) notFound();
  const details = (job.errors && typeof job.errors === "object" && !Array.isArray(job.errors) ? job.errors : {}) as Detail;
  const rows = details.rowDetails ?? [];
  const base = `/superadmin/villages/${villageId}/population/import`;
  return <div className="space-y-6"><header><Link href={base} className="text-sm text-slate-500">← กลับงานนำเข้า</Link><div className="mt-2 flex flex-wrap justify-between gap-3"><div><h2 className="text-2xl font-semibold">Preview: {job.fileName}</h2><p className="mt-1 text-sm text-slate-500">ตรวจพบ {job.totalRows} แถว · สร้างใหม่ {job.createdRows} · แก้ไข {job.updatedRows} · ขัดแย้ง {job.conflictRows}</p></div><Badge variant={job.stage === PopulationImportStage.COMPLETED ? "success" : job.stage === PopulationImportStage.FAILED ? "danger" : "warning"}>{job.stage}</Badge></div></header>
    <section className="overflow-hidden rounded-xl border bg-white"><div className="overflow-x-auto"><table className="min-w-[680px] w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="px-4 py-3">แถว</th><th className="px-4 py-3">การทำงาน</th><th className="px-4 py-3">สถานะ</th><th className="px-4 py-3">รายละเอียด</th></tr></thead><tbody>{rows.slice(0, 200).map((row, index) => <tr key={`${row.rowNumber}-${index}`} className="border-t"><td className="px-4 py-3">{row.rowNumber}</td><td className="px-4 py-3">{row.action ?? "-"}</td><td className="px-4 py-3">{row.status ?? "-"}</td><td className="px-4 py-3 text-rose-700">{row.errorMessage ?? "พร้อมนำเข้า"}</td></tr>)}</tbody></table></div>{!rows.length ? <p className="p-8 text-center text-sm text-slate-500">ไม่มีรายละเอียดรายแถว</p> : null}</section>
    {job.stage === PopulationImportStage.PENDING ? <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h3 className="font-semibold text-amber-950">ยืนยันนำเข้า</h3><ImportConfirmForm jobId={jobId} targetVillageId={villageId} confirmAction={confirmWorkspaceImportAction.bind(null, villageId)} /></section> : null}
  </div>;
}

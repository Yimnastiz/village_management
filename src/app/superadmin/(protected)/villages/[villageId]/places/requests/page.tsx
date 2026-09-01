import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { prisma } from "@/lib/prisma";
import { WorkspaceListPage } from "../../workspace-list-page";

export default async function SuperAdminPlaceRequests({ params }: { params: Promise<{ villageId: string }> }) {
  const { villageId } = await params;
  const db = (prisma as unknown as { villagePlaceSubmission: { findMany: (args: unknown) => Promise<Array<{ id: string; status: string; type: string; createdAt: Date; payload: unknown; requester: { name: string; phoneNumber: string } }>> } }).villagePlaceSubmission;
  const rows = await db.findMany({ where: { villageId }, orderBy: { createdAt: "desc" }, include: { requester: { select: { name: true, phoneNumber: true } } } });
  const base = `/superadmin/villages/${villageId}/places`;
  return <WorkspaceListPage><div className="mx-auto flex w-full max-w-4xl flex-col gap-3"><SuperAdminPageHeaderRegistration priority={1} context={{ title: "คำขอสถานที่", description: "ตรวจสอบคำขอของลูกบ้านในหมู่บ้านนี้" }} /><Link href={base} className="inline-flex min-h-9 items-center gap-1.5 self-start px-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />กลับสถานที่</Link><div className="grid gap-3">{rows.length ? rows.map((row) => <Link key={row.id} href={`${base}/requests/${row.id}`} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm"><div className="min-w-0"><p className="break-words font-medium">{(row.payload as { name?: string })?.name ?? "คำขอสถานที่"}</p><p className="break-words text-sm text-gray-600">{row.requester.name} · {row.type} · {row.createdAt.toLocaleDateString("th-TH")}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-xs ${row.status === "PENDING" ? "border-amber-200 bg-amber-50 text-amber-800" : row.status === "APPROVED" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>{row.status}</span></Link>) : <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">ยังไม่มีคำขอสถานที่</div>}</div></div></WorkspaceListPage>;
}

import { notFound, redirect } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DownloadVisibilityMetadata } from "@/components/downloads/download-metadata";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { DOWNLOAD_STAGE_LABELS } from "@/lib/downloads/constants";
import { downloadTypeLabel } from "@/lib/download-upload";
import { formatFileSize } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { DownloadManagementActions } from "./download-management-actions";

interface PageProps { params: Promise<{ fileId: string }> }
const stageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = { DRAFT: "warning", PUBLISHED: "success", ARCHIVED: "default" };

export default async function Page({ params }: PageProps) {
  const { fileId } = await params; const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login"); if (!isAdminUser(session)) redirect("/resident");
  const membership = await prisma.villageMembership.findFirst({ where: { userId: session.id, status: "ACTIVE" }, select: { villageId: true } }); if (!membership) redirect("/auth/login");
  const file = await prisma.downloadFile.findFirst({ where: { id: fileId, villageId: membership.villageId }, include: { attachments: { orderBy: { sortOrder: "asc" } } } }); if (!file) notFound();
  const totalSize = file.attachments.reduce((total, attachment) => total + attachment.fileSize, 0);
  return <div data-admin-compact-top className="space-y-5"><AdminPageToolbar sticky variant="detail" title="รายละเอียดเอกสาร" description="จัดการรายละเอียดเอกสารและไฟล์แนบ" backHref="/admin/downloads" backLabel="กลับรายการเอกสาร" backPlacement="top" actions={<DownloadManagementActions fileId={file.id} stage={file.stage} />} /><div className="mx-auto w-full max-w-4xl"><section className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 sm:p-8"><div><Badge variant={stageVariant[file.stage] ?? "default"}>{DOWNLOAD_STAGE_LABELS[file.stage]}</Badge><h1 className="mt-3 break-words text-2xl font-bold text-gray-900 sm:text-3xl">{file.title}</h1><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-gray-500"><DownloadVisibilityMetadata visibility={file.visibility} category={file.category} categoryLabel={file.categoryLabel} /></div></div>{file.description ? <div><h2 className="sr-only">รายละเอียดเอกสาร</h2><p className="break-words whitespace-pre-wrap leading-7 text-gray-700">{file.description}</p></div> : null}<div className="grid grid-cols-1 gap-3 border-y border-gray-200 py-3 text-sm sm:grid-cols-3"><div><p className="text-gray-500">ขนาดรวม</p><p className="mt-1 font-medium text-gray-900">{formatFileSize(totalSize)}</p></div><div><p className="text-gray-500">ดาวน์โหลด</p><p className="mt-1 font-medium text-gray-900">{file.downloadCount} ครั้ง</p></div><div><p className="text-gray-500">วันที่เผยแพร่</p><p className="mt-1 font-medium text-gray-900">{file.publishedAt ? file.publishedAt.toLocaleDateString("th-TH") : "-"}</p></div></div><div><h2 className="mb-3 font-semibold text-gray-900">ไฟล์แนบ ({file.attachments.length})</h2>{file.attachments.length ? <ul className="overflow-hidden rounded-xl border border-gray-200 divide-y divide-gray-100">{file.attachments.map((attachment) => <li key={attachment.id} className="flex min-w-0 flex-wrap items-center gap-3 px-3 py-3 sm:flex-nowrap sm:px-4"><FileText className="h-5 w-5 shrink-0 text-gray-400" /><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium text-gray-800">{attachment.fileName}</p><p className="mt-0.5 text-xs text-gray-500">{downloadTypeLabel(attachment.mimeType, attachment.fileName)} · {formatFileSize(attachment.fileSize)}</p></div><a href={`/api/downloads/${attachment.id}`} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm font-medium text-green-700 hover:bg-green-50"><Download className="mr-1 h-4 w-4" />ดาวน์โหลด</a></li>)}</ul> : <p className="text-sm text-rose-600">ยังไม่มีไฟล์แนบ</p>}</div></section></div></div>;
}

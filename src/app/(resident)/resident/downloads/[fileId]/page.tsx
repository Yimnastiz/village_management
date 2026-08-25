import Link from "next/link";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { SaveButton } from "@/components/ui/save-button";
import { DownloadVisibilityMetadata } from "@/components/downloads/download-metadata";
import { downloadTypeLabel } from "@/lib/download-upload";
import { formatFileSize } from "@/lib/utils";
import { getResidentVillageAccess, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { toggleSaveDownloadAction } from "@/features/saved/server/actions";

interface PageProps { params: Promise<{ fileId: string }> }

export default async function ResidentDownloadDetailPage({ params }: PageProps) {
  const { fileId } = await params; const session = await getSessionContextFromServerCookies(); if (!session?.id) redirect("/auth/login");
  const membership = await getResidentVillageAccess(session); if (!membership) redirect("/resident/dashboard");
  const file = await prisma.downloadFile.findFirst({ where: { id: fileId, villageId: membership.villageId, stage: "PUBLISHED", visibility: membership.hasResidentAccess ? { in: ["PUBLIC", "RESIDENT_ONLY"] } : "PUBLIC" }, include: { attachments: { orderBy: { sortOrder: "asc" } } } }); if (!file) notFound();
  const saved = await prisma.savedItem.findFirst({ where: { userId: session.id, downloadId: file.id }, select: { id: true } });
  return <div className="mx-auto w-full max-w-4xl space-y-6"><Link href="/resident/downloads" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />กลับรายการเอกสาร</Link><section className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h1 className="break-words text-2xl font-bold text-gray-900 sm:text-3xl">{file.title}</h1><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-gray-500"><DownloadVisibilityMetadata visibility={file.visibility} category={file.category} categoryLabel={file.categoryLabel} /></div></div>{membership.hasResidentAccess ? <SaveButton itemId={file.id} initialSaved={Boolean(saved)} toggleAction={toggleSaveDownloadAction} label="บันทึกเอกสาร" /> : null}</div>{file.description ? <div><h2 className="sr-only">รายละเอียดเอกสาร</h2><p className="break-words whitespace-pre-wrap leading-7 text-gray-700">{file.description}</p></div> : null}<div><h2 className="mb-3 font-semibold text-gray-900">ไฟล์แนบ ({file.attachments.length})</h2>{file.attachments.length ? <ul className="overflow-hidden rounded-xl border border-gray-200 divide-y divide-gray-100">{file.attachments.map((attachment) => <li key={attachment.id} className="flex min-w-0 flex-wrap items-center gap-3 px-3 py-3 sm:flex-nowrap sm:px-4"><FileText className="h-5 w-5 shrink-0 text-gray-400" /><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium text-gray-800">{attachment.fileName}</p><p className="mt-0.5 text-xs text-gray-500">{downloadTypeLabel(attachment.mimeType, attachment.fileName)} · {formatFileSize(attachment.fileSize)}</p></div><a href={`/api/downloads/${attachment.id}`} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm font-medium text-green-700 hover:bg-green-50"><Download className="mr-1 h-4 w-4" />ดาวน์โหลด</a></li>)}</ul> : <p className="text-sm text-gray-500">ยังไม่มีไฟล์แนบ</p>}</div></section></div>;
}

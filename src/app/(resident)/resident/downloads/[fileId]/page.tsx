import Link from "next/link";
import { Fragment } from "react";
import { ArrowLeft, Download, FileText, Globe2, Users } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { SaveButton } from "@/components/ui/save-button";
import { downloadTypeLabel } from "@/lib/download-upload";
import { DOWNLOAD_CATEGORY_LABELS } from "@/lib/downloads/constants";
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
  const categoryText = file.category === "OTHER"
    ? file.categoryLabel || DOWNLOAD_CATEGORY_LABELS.OTHER
    : file.category
      ? DOWNLOAD_CATEGORY_LABELS[file.category] || file.category
      : "ทั่วไป";
  const VisibilityIcon = file.visibility === "PUBLIC" ? Globe2 : Users;
  const visibilityLabel = file.visibility === "PUBLIC" ? "สาธารณะ" : "เฉพาะลูกบ้าน";
  const metadataItems = [
    <span key="visibility" className="inline-flex items-center gap-1.5"><VisibilityIcon className="h-3.5 w-3.5 shrink-0" />{visibilityLabel}</span>,
    <span key="category">{categoryText}</span>,
  ];
  const detailDate = file.publishedAt ?? file.createdAt;
  const dateLabel = file.publishedAt ? "เผยแพร่เมื่อ" : "เพิ่มเมื่อ";
  return <div className="mx-auto w-full max-w-4xl space-y-6"><Link href="/resident/downloads" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />กลับรายการเอกสาร</Link><section className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h1 className="break-words text-2xl font-bold text-gray-900 sm:text-3xl">{file.title}</h1><div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-gray-500">{metadataItems.map((item, index) => <Fragment key={index}>{index > 0 ? <span className="text-gray-400">·</span> : null}{item}</Fragment>)}</div><p className="mt-2 text-sm text-gray-500">{dateLabel} {detailDate.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</p></div>{membership.hasResidentAccess ? <div className="shrink-0 self-start"><SaveButton itemId={file.id} initialSaved={Boolean(saved)} toggleAction={toggleSaveDownloadAction} label="บันทึกเอกสาร" /></div> : null}</div>{file.description ? <div><h2 className="sr-only">รายละเอียดเอกสาร</h2><p className="break-words whitespace-pre-wrap leading-7 text-gray-700">{file.description}</p></div> : null}<div><h2 className="mb-3 font-semibold text-gray-900">ไฟล์แนบ ({file.attachments.length})</h2>{file.attachments.length ? <ul className="overflow-hidden rounded-xl border border-gray-200 divide-y divide-gray-100">{file.attachments.map((attachment) => <li key={attachment.id} className="flex min-w-0 flex-wrap items-center gap-3 px-3 py-3 sm:flex-nowrap sm:px-4"><FileText className="h-5 w-5 shrink-0 text-gray-400" /><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium text-gray-800">{attachment.fileName}</p><p className="mt-0.5 text-xs text-gray-500">{downloadTypeLabel(attachment.mimeType, attachment.fileName)} · {formatFileSize(attachment.fileSize)}</p></div><a href={`/api/downloads/${attachment.id}`} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm font-medium text-green-700 hover:bg-green-50"><Download className="mr-1 h-4 w-4" />ดาวน์โหลด</a></li>)}</ul> : <p className="text-sm text-gray-500">ยังไม่มีไฟล์แนบ</p>}</div></section></div>;
}

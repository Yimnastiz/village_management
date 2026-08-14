import Link from "next/link";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { notFound } from "next/navigation";
import { DOWNLOAD_CATEGORY_LABELS } from "@/lib/constants";
import { downloadTypeLabel } from "@/lib/download-upload";
import { formatFileSize } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { normalizeVillageSlugParam, getSlugVariants } from "@/lib/village-slug";

interface PageProps { params: Promise<{ villageSlug: string; fileId: string }> }
export default async function DownloadDetailPage({ params }: PageProps) {
  const { villageSlug: rawVillageSlug, fileId } = await params; const villageSlug = normalizeVillageSlugParam(rawVillageSlug);
  const village = await prisma.village.findFirst({ where: { slug: { in: getSlugVariants(villageSlug) } }, select: { id: true, slug: true } }); if (!village) notFound();
  const file = await prisma.downloadFile.findFirst({ where: { id: fileId, villageId: village.id, stage: "PUBLISHED", visibility: "PUBLIC" }, include: { attachments: { orderBy: { sortOrder: "asc" } } } }); if (!file) notFound();
  return <div className="mx-auto max-w-3xl space-y-6"><Link href={`/${village.slug}/downloads`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />กลับรายการเอกสาร</Link><section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"><h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{file.title}</h1>{file.description ? <p className="text-gray-600">{file.description}</p> : null}<p className="text-sm text-gray-500">หมวดหมู่: {file.category === "OTHER" ? file.categoryLabel || DOWNLOAD_CATEGORY_LABELS.OTHER : file.category ? DOWNLOAD_CATEGORY_LABELS[file.category] || file.category : "ทั่วไป"}</p><div><h2 className="mb-2 font-semibold text-gray-900">ไฟล์แนบ ({file.attachments.length})</h2><ul className="overflow-hidden rounded-xl border border-gray-200 divide-y divide-gray-100">{file.attachments.map((attachment) => <li key={attachment.id} className="flex min-w-0 items-center gap-3 px-3 py-3 sm:px-4"><FileText className="h-5 w-5 shrink-0 text-gray-400" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-gray-800">{attachment.fileName}</p><p className="mt-0.5 text-xs text-gray-500">{downloadTypeLabel(attachment.mimeType, attachment.fileName)} · {formatFileSize(attachment.fileSize)}</p></div><a href={`/api/downloads/${attachment.id}`} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm font-medium text-green-700 hover:bg-green-50"><Download className="mr-1 h-4 w-4" />ดาวน์โหลด</a></li>)}</ul></div></section></div>;
}

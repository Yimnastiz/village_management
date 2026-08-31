import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { DownloadForm } from "@/app/(admin)/admin/downloads/download-form";
import { DOWNLOAD_CATEGORY_LABELS } from "@/lib/downloads/constants";
import { prisma } from "@/lib/prisma";
export default async function Page({ params }: { params: Promise<{ villageId: string; fileId: string }> }) { const { villageId, fileId } = await params; const file = await prisma.downloadFile.findFirst({ where: { id: fileId, villageId }, include: { attachments: { orderBy: { sortOrder: "asc" } } } }); if (!file) notFound(); return <div className="mx-auto w-full max-w-3xl space-y-3"><Link href={`/superadmin/villages/${villageId}/downloads/${fileId}`} className="inline-flex items-center gap-1.5 py-2 text-sm text-gray-500"><ArrowLeft className="h-4 w-4" />กลับรายละเอียดเอกสาร</Link><DownloadForm mode="edit" fileId={file.id} superAdmin={{ villageId }} defaultValues={{ title: file.title, description: file.description ?? "", category: file.category && file.category in DOWNLOAD_CATEGORY_LABELS ? file.category : "OTHER", categoryLabel: file.category === "OTHER" ? file.categoryLabel : file.category && !(file.category in DOWNLOAD_CATEGORY_LABELS) ? file.category : null, visibility: file.visibility }} initialAttachments={file.attachments} /></div>; }

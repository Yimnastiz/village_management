import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { prisma } from "@/lib/prisma";
import { formatThaiDateTime } from "@/lib/utils";
import { SuperAdminSubmissionReview } from "../../superadmin-gallery-actions";

export default async function GallerySubmissionDetail({ params }: { params: Promise<{ villageId: string; submissionId: string }> }) {
  const { villageId, submissionId } = await params;
  const row = await prisma.galleryItemSubmission.findFirst({ where: { id: submissionId, album: { villageId } }, include: { album: { select: { id: true, title: true } }, requester: { select: { name: true, phoneNumber: true } } } });
  if (!row) notFound();
  return <div className="mx-auto w-full max-w-3xl space-y-3 px-1 sm:px-0"><SuperAdminPageHeaderRegistration priority={1} context={{ title: "รายละเอียดคำขอเพิ่มรูปภาพ", description: "ตรวจสอบรูปภาพและข้อมูลผู้ส่งคำขอ" }} /><AdminPageToolbar sticky hideHeading variant="request" title="รายละเอียดคำขอเพิ่มรูปภาพ" actions={<div className="flex w-full flex-wrap items-center"><Link href={`/superadmin/villages/${villageId}/gallery/submissions`} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" aria-hidden="true" />กลับรายการคำขอ</Link></div>} className="py-2 sm:py-2" /><article className="min-w-0 space-y-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"><div className="flex flex-wrap items-center gap-2"><Badge variant={row.status === "PENDING" ? "warning" : row.status === "APPROVED" ? "success" : "danger"}>{row.status}</Badge><Badge variant="outline">{row.album.title}</Badge></div><h1 className="break-words text-xl font-bold text-gray-900">{row.title || "รูปภาพ"}</h1><div className="space-y-1 break-words text-sm text-gray-600"><p>ผู้ส่งคำขอ: {row.requester.name} ({row.requester.phoneNumber})</p><p>ส่งเมื่อ: {formatThaiDateTime(row.createdAt)}</p>{row.reviewNote ? <p>เหตุผลที่ไม่อนุมัติ: {row.reviewNote}</p> : null}</div><div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50"><img src={row.fileUrl} alt={row.title || "รูปภาพคำขอ"} className="max-h-[520px] w-full object-contain" /></div>{row.note ? <p className="whitespace-pre-wrap text-sm text-gray-700">{row.note}</p> : null}{row.status === "PENDING" ? <SuperAdminSubmissionReview villageId={villageId} submissionId={row.id} /> : <p className="text-sm text-gray-500">คำขอนี้ถูกดำเนินการแล้ว</p>}</article></div>;
}

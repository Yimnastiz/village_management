import Link from "next/link";
import { CorrectionRequestStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getVillagePermissionContext } from "@/lib/admin-permission.server";
import { prisma } from "@/lib/prisma";
import { CorrectionReviewForm } from "../correction-review-form";

interface PageProps { params: Promise<{ requestId: string }> }
export default async function Page({ params }: PageProps) {
  const { requestId } = await params;
  const context = await getVillagePermissionContext("population.corrections.review");
  if (!context) return null;
  const request = await prisma.householdCorrectionRequest.findFirst({ where: { id: requestId, villageId: context.villageId }, include: { house: { select: { houseNumber: true, address: true } } } });
  if (!request) notFound();
  return (
    <div className="space-y-6">
      <div><Link href="/admin/population/corrections" className="text-sm text-gray-500">← กลับรายการคำขอ</Link><div className="mt-2 flex justify-between gap-3"><h1 className="text-2xl font-bold text-gray-900">{request.subject}</h1><Badge variant={request.status === CorrectionRequestStatus.APPROVED ? "success" : request.status === CorrectionRequestStatus.REJECTED ? "danger" : "warning"}>{request.status}</Badge></div></div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="whitespace-pre-wrap text-gray-700">{request.description}</p>
        <dl className="mt-5 grid gap-3 border-t pt-4 text-sm sm:grid-cols-2"><div><dt className="text-gray-500">บ้าน</dt><dd>{request.house?.houseNumber ?? "-"}</dd></div><div><dt className="text-gray-500">ผลการพิจารณา</dt><dd>{request.reviewNote ?? "-"}</dd></div></dl>
        {request.status === CorrectionRequestStatus.PENDING ? <CorrectionReviewForm requestId={request.id} /> : null}
      </div>
    </div>
  );
}

import Link from "next/link";
import { CorrectionRequestStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { getVillagePermissionContext } from "@/lib/admin-permission.server";
import { prisma } from "@/lib/prisma";

export default async function Page() {
  const context = await getVillagePermissionContext("population.corrections.review");
  if (!context) return null;
  const requests = await prisma.householdCorrectionRequest.findMany({
    where: { villageId: context.villageId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { house: { select: { houseNumber: true } } },
  });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">คำขอแก้ไขข้อมูลประชากร</h1>
      <div className="space-y-3">
        {requests.map((request) => (
          <Link key={request.id} href={`/admin/population/corrections/${request.id}`} className="block rounded-xl border border-gray-200 bg-white p-4 hover:shadow-sm">
            <div className="flex justify-between gap-3"><div><p className="font-semibold text-gray-900">{request.subject}</p><p className="mt-1 line-clamp-2 text-sm text-gray-500">{request.description}</p><p className="mt-2 text-xs text-gray-400">บ้าน {request.house?.houseNumber ?? "-"} · {request.createdAt.toLocaleString("th-TH")}</p></div><Badge variant={request.status === CorrectionRequestStatus.APPROVED ? "success" : request.status === CorrectionRequestStatus.REJECTED ? "danger" : "warning"}>{request.status}</Badge></div>
          </Link>
        ))}
        {!requests.length ? <div className="rounded-xl border border-dashed p-10 text-center text-sm text-gray-500">ไม่พบคำขอแก้ไขข้อมูล</div> : null}
      </div>
    </div>
  );
}

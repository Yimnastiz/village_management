import Link from "next/link";
import { FileClock } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  VILLAGE_PLACE_CATEGORY_LABELS,
  VILLAGE_PLACE_SUBMISSION_STATUS_LABELS,
  VILLAGE_PLACE_SUBMISSION_TYPE_LABELS,
} from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, getHeadmanMembership, isAdminUser } from "@/lib/access-control";
import { parseVillagePlacePayload } from "@/lib/village-place";

type RequestItem = {
  id: string;
  type: string;
  status: string;
  payload: unknown;
  createdAt: Date;
  requester: {
    name: string;
    phoneNumber: string;
  };
};

type VillagePlaceSubmissionListDelegate = {
  findMany(args: unknown): Promise<RequestItem[]>;
};

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export default async function AdminPlaceRequestListPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = getHeadmanMembership(session);
  if (!membership) redirect("/auth/login");

  const villagePlaceSubmission =
    (prisma as unknown as { villagePlaceSubmission: VillagePlaceSubmissionListDelegate }).villagePlaceSubmission;

  const requests = await villagePlaceSubmission.findMany({
    where: { villageId: membership.villageId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      requester: { select: { name: true, phoneNumber: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">คำขอสถานที่จากลูกบ้าน</h1>
        <p className="mt-1 text-sm text-gray-500">ตรวจสอบและอนุมัติคำขอเพิ่มสถานที่สำคัญ</p>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <FileClock className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gray-600">ยังไม่มีคำขอสถานที่</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const payload = parseVillagePlacePayload(request.payload);
            return (
              <Link
                key={request.id}
                href={`/admin/places/requests/${request.id}`}
                className="block rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {VILLAGE_PLACE_SUBMISSION_TYPE_LABELS[request.type] ?? request.type}
                      </Badge>
                      <Badge variant={statusVariant[request.status] ?? "default"}>
                        {VILLAGE_PLACE_SUBMISSION_STATUS_LABELS[request.status] ?? request.status}
                      </Badge>
                      <Badge variant="outline">
                        {VILLAGE_PLACE_CATEGORY_LABELS[payload?.category ?? "OTHER"]}
                      </Badge>
                    </div>
                    <p className="font-medium text-gray-900">{payload?.name ?? "ข้อมูลคำขอไม่ถูกต้อง"}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      ผู้ส่งคำขอ: {request.requester.name} ({request.requester.phoneNumber})
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-xs text-gray-400">
                    {new Date(request.createdAt).toLocaleDateString("th-TH")}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

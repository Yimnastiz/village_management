import Link from "next/link";
import { FileClock } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  VILLAGE_EVENT_SUBMISSION_STATUS_LABELS,
  VILLAGE_EVENT_VISIBILITY_LABELS,
} from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, getHeadmanMembership, isAdminUser } from "@/lib/access-control";

type RequestItem = {
  id: string;
  status: string;
  isPublic: boolean;
  title: string;
  createdAt: Date;
  requester: {
    name: string;
    phoneNumber: string;
  };
};

type VillageEventSubmissionListDelegate = {
  findMany(args: unknown): Promise<RequestItem[]>;
};

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export default async function AdminCalendarRequestListPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = getHeadmanMembership(session);
  if (!membership) redirect("/auth/login");

  const villageEventSubmission = (
    prisma as unknown as { villageEventSubmission: VillageEventSubmissionListDelegate }
  ).villageEventSubmission;

  const requests = await villageEventSubmission.findMany({
    where: { villageId: membership.villageId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      requester: { select: { name: true, phoneNumber: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">คำขอกิจกรรมจากลูกบ้าน</h1>
        <p className="mt-1 text-sm text-gray-500">ตรวจสอบและอนุมัติคำขอเพิ่มกิจกรรมหมู่บ้าน</p>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <FileClock className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gray-600">ยังไม่มีคำขอกิจกรรม</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request: RequestItem) => (
            <Link
              key={request.id}
              href={`/admin/calendar/requests/${request.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant={statusVariant[request.status] ?? "default"}>
                      {VILLAGE_EVENT_SUBMISSION_STATUS_LABELS[request.status] ?? request.status}
                    </Badge>
                    <Badge variant="outline">
                      {VILLAGE_EVENT_VISIBILITY_LABELS[request.isPublic ? "PUBLIC" : "RESIDENT"]}
                    </Badge>
                  </div>
                  <p className="font-medium text-gray-900">{request.title}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    ผู้ส่งคำขอ: {request.requester.name} ({request.requester.phoneNumber})
                  </p>
                </div>
                <p className="whitespace-nowrap text-xs text-gray-400">
                  {new Date(request.createdAt).toLocaleDateString("th-TH")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

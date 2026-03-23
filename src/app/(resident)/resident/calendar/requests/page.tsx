import Link from "next/link";
import { FileClock, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  VILLAGE_EVENT_SUBMISSION_STATUS_LABELS,
  VILLAGE_EVENT_VISIBILITY_LABELS,
} from "@/lib/constants";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

type RequestItem = {
  id: string;
  status: string;
  isPublic: boolean;
  title: string;
  startsAt: Date;
  location: string | null;
  reviewNote: string | null;
  createdAt: Date;
};

type VillageEventSubmissionListDelegate = {
  findMany(args: unknown): Promise<RequestItem[]>;
};

type ResidentCalendarRequestsPageProps = {
  searchParams?: Promise<{ submitted?: string }>;
};

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export default async function ResidentCalendarRequestsPage({ searchParams }: ResidentCalendarRequestsPageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const villageEventSubmission = (
    prisma as unknown as { villageEventSubmission: VillageEventSubmissionListDelegate }
  ).villageEventSubmission;

  const requests = await villageEventSubmission.findMany({
    where: { requesterId: session.id },
    orderBy: [{ createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">คำขอกิจกรรมของฉัน</h1>
          <p className="mt-1 text-sm text-gray-500">ติดตามสถานะคำขอเพิ่มกิจกรรมหมู่บ้าน</p>
        </div>
        <Link href="/resident/calendar/requests/new">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> ส่งคำขอเพิ่มกิจกรรม
          </Button>
        </Link>
      </div>

      {params.submitted === "1" && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          ส่งคำขอเรียบร้อยแล้ว รอแอดมินพิจารณา
        </div>
      )}

      {requests.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <FileClock className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gray-600">ยังไม่มีคำขอกิจกรรม</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request: RequestItem) => (
            <div key={request.id} className="rounded-xl border border-gray-200 bg-white p-5">
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
                    {new Date(request.startsAt).toLocaleString("th-TH")}
                    {request.location ? ` • ${request.location}` : ""}
                  </p>
                  {request.reviewNote && <p className="mt-2 text-sm text-gray-600">หมายเหตุ: {request.reviewNote}</p>}
                </div>
                <p className="whitespace-nowrap text-xs text-gray-400">
                  {new Date(request.createdAt).toLocaleDateString("th-TH")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

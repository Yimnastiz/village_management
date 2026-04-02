import Link from "next/link";
import { FileClock, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  VILLAGE_PLACE_CATEGORY_LABELS,
  VILLAGE_PLACE_SUBMISSION_STATUS_LABELS,
  VILLAGE_PLACE_SUBMISSION_TYPE_LABELS,
} from "@/lib/constants";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { parseVillagePlacePayload } from "@/lib/village-place";

type RequestItem = {
  id: string;
  type: string;
  status: string;
  payload: unknown;
  reviewNote: string | null;
  createdAt: Date;
};

type VillagePlaceSubmissionListDelegate = {
  findMany(args: unknown): Promise<RequestItem[]>;
};

type PageProps = {
  searchParams?: Promise<{ submitted?: string }>;
};

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export default async function ResidentPlaceRequestsPage({ searchParams }: PageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const villagePlaceSubmission =
    (prisma as unknown as { villagePlaceSubmission: VillagePlaceSubmissionListDelegate }).villagePlaceSubmission;

  const requests = await villagePlaceSubmission.findMany({
    where: { requesterId: session.id },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      payload: true,
      reviewNote: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">คำขอสถานที่ของฉัน</h1>
          <p className="mt-1 text-sm text-gray-500">ติดตามสถานะคำขอเพิ่มสถานที่สำคัญในหมู่บ้าน</p>
        </div>
        <Link href="/resident/places/requests/new">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> ส่งคำขอเพิ่มสถานที่
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
          <p className="text-gray-600">ยังไม่มีคำขอสถานที่</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const payload = parseVillagePlacePayload(request.payload);
            return (
              <div key={request.id} className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex flex-wrap items-center gap-2">
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
                <p className="mt-2 font-medium text-gray-900">{payload?.name ?? "ไม่สามารถอ่านข้อมูลคำขอ"}</p>
                {payload?.address && <p className="mt-1 text-sm text-gray-600">{payload.address}</p>}
                {request.reviewNote && <p className="mt-2 text-sm text-gray-600">หมายเหตุ: {request.reviewNote}</p>}
                <p className="mt-2 text-xs text-gray-400">{new Date(request.createdAt).toLocaleDateString("th-TH")}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

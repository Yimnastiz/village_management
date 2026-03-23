import Link from "next/link";
import { FileClock } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { NEWS_SUBMISSION_STATUS_LABELS, NEWS_SUBMISSION_TYPE_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser, getHeadmanMembership } from "@/lib/access-control";

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export default async function AdminNewsRequestListPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = getHeadmanMembership(session);
  if (!membership) redirect("/auth/login");

  const requests = await prisma.newsSubmission.findMany({
    where: { villageId: membership.villageId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      requester: { select: { name: true } },
      targetNews: { select: { title: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">คำขอข่าวจากลูกบ้าน</h1>
        <p className="text-sm text-gray-500 mt-1">ตรวจสอบและอนุมัติคำขอเพิ่มหรือแก้ไขข่าว</p>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <FileClock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">ยังไม่มีคำขอข่าว</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <Link
              key={request.id}
              href={`/admin/news/requests/${request.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={statusVariant[request.status] ?? "default"}>
                      {NEWS_SUBMISSION_STATUS_LABELS[request.status]}
                    </Badge>
                    <Badge variant="outline">{NEWS_SUBMISSION_TYPE_LABELS[request.type]}</Badge>
                  </div>
                  <p className="text-sm text-gray-700">ผู้ส่งคำขอ: {request.requester.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {request.targetNews?.title ? `อ้างอิงข่าว: ${request.targetNews.title}` : "คำขอเพิ่มข่าวใหม่"}
                  </p>
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap">
                  {request.createdAt.toLocaleDateString("th-TH")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

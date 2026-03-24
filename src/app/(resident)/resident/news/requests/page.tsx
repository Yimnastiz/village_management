import Link from "next/link";
import { Plus, FileClock } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NEWS_SUBMISSION_STATUS_LABELS, NEWS_SUBMISSION_TYPE_LABELS } from "@/lib/constants";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { deletePendingNewsSubmissionAction } from "./actions";

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export default async function ResidentNewsRequestsPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const requests = await prisma.newsSubmission.findMany({
    where: { requesterId: session.id },
    orderBy: [{ createdAt: "desc" }],
    include: {
      targetNews: {
        select: { id: true, title: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">คำขอข่าวของฉัน</h1>
          <p className="text-sm text-gray-500 mt-1">ติดตามสถานะคำขอเพิ่มหรือแก้ไขข่าว</p>
        </div>
        <Link href="/resident/news/requests/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> ส่งคำขอเพิ่มข่าว
          </Button>
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <FileClock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">ยังไม่มีคำขอข่าว</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <article key={request.id} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={statusVariant[request.status] ?? "default"}>
                      {NEWS_SUBMISSION_STATUS_LABELS[request.status]}
                    </Badge>
                    <Badge variant="outline">{NEWS_SUBMISSION_TYPE_LABELS[request.type]}</Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    {request.targetNews?.title ? `อ้างอิงข่าว: ${request.targetNews.title}` : "คำขอเพิ่มข่าวใหม่"}
                  </p>
                  {request.reviewNote && <p className="text-sm text-gray-700 mt-2">หมายเหตุ: {request.reviewNote}</p>}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link href={`/resident/news/requests/${request.id}`}>
                      <Button size="sm" variant="outline">ดูรายละเอียด</Button>
                    </Link>

                    {request.status === "PENDING" && (
                      <>
                        <Link href={`/resident/news/requests/${request.id}/edit`}>
                          <Button size="sm" variant="outline">แก้ไขคำขอ</Button>
                        </Link>
                        <form
                          action={async () => {
                            "use server";
                            await deletePendingNewsSubmissionAction(request.id);
                          }}
                        >
                          <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700">
                            ลบคำขอ
                          </Button>
                        </form>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap">
                  {request.createdAt.toLocaleDateString("th-TH")}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

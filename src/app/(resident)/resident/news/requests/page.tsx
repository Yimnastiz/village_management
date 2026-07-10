import Link from "next/link";
import { Plus, FileClock, Newspaper } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NEWS_SUBMISSION_STATUS_LABELS, NEWS_SUBMISSION_TYPE_LABELS } from "@/lib/constants";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { deletePendingNewsSubmissionAction, createNewsDeleteRequestAction } from "./actions";

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export default async function ResidentNewsRequestsPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");

  const [requests, myNews] = await Promise.all([
    prisma.newsSubmission.findMany({
      where: { requesterId: session.id, villageId: membership.villageId },
      orderBy: [{ createdAt: "desc" }],
      include: {
        targetNews: {
          select: { id: true, title: true },
        },
      },
    }),
    prisma.news.findMany({
      where: {
        authorId: session.id,
        villageId: membership.villageId,
        stage: "PUBLISHED",
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      include: {
        submissions: {
          where: { status: "PENDING" },
          select: { id: true, type: true, payload: true },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-10">
      {/* Requests Section */}
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
            {requests.map((request) => {
              const payload = request.payload as any;
              const isDeleteRequest = payload?.isDeleteRequest === true;
              return (
                <article key={request.id} className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={statusVariant[request.status] ?? "default"}>
                          {NEWS_SUBMISSION_STATUS_LABELS[request.status]}
                        </Badge>
                        <Badge variant="outline">
                          {isDeleteRequest ? "ขอลบข่าว" : NEWS_SUBMISSION_TYPE_LABELS[request.type]}
                        </Badge>
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
                            {!isDeleteRequest && (
                              <Link href={`/resident/news/requests/${request.id}/edit`}>
                                <Button size="sm" variant="outline">แก้ไขคำขอ</Button>
                              </Link>
                            )}
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
              );
            })}
          </div>
        )}
      </div>

      {/* Published News Section */}
      <div className="space-y-6 pt-6 border-t border-gray-200">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-green-600" />
            ข่าวสารที่เผยแพร่แล้วของฉัน
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            รายการข่าวสารที่คุณเป็นผู้เขียนและเผยแพร่อยู่ในระบบ คุณสามารถยื่นคำขอแก้ไขหรือคำขอลบข่าวได้
          </p>
        </div>

        {myNews.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
            ยังไม่มีข่าวสารที่คุณเผยแพร่
          </div>
        ) : (
          <div className="space-y-3">
            {myNews.map((news) => {
              const pendingSubmissions = news.submissions;
              const hasPendingRequest = pendingSubmissions.length > 0;
              const pendingType = pendingSubmissions[0]?.type;
              const isPendingDelete = (pendingSubmissions[0]?.payload as any)?.isDeleteRequest === true;

              return (
                <article key={news.id} className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-base leading-tight truncate">{news.title}</p>
                      <p className="text-xs text-gray-400 mt-1.5">
                        เผยแพร่เมื่อ: {news.publishedAt ? news.publishedAt.toLocaleDateString("th-TH") : "-"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {hasPendingRequest ? (
                        <Badge variant="warning">
                          {isPendingDelete ? "อยู่ระหว่างรออนุมัติลบข่าว" : "อยู่ระหว่างรออนุมัติแก้ไขข่าว"}
                        </Badge>
                      ) : (
                        <>
                          <Link href={`/resident/news/requests/new?newsId=${news.id}`}>
                            <Button size="sm" variant="outline">
                              ขอแก้ไขข่าว
                            </Button>
                          </Link>
                          <form
                            action={async () => {
                              "use server";
                              await createNewsDeleteRequestAction(news.id);
                            }}
                            onSubmit={(e) => {
                              if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการส่งคำขอลบข่าวนี้?")) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200">
                              ขอลบข่าว
                            </Button>
                          </form>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


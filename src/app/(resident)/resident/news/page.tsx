import Link from "next/link";
import { FilePlus2, Newspaper } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NEWS_VISIBILITY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies } from "@/lib/access-control";

export default async function ResidentNewsPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const newsList = await prisma.news.findMany({
    where: {
      villageId: membership.villageId,
      stage: "PUBLISHED",
      visibility: { in: ["PUBLIC", "RESIDENT_ONLY"] },
    },
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      summary: true,
      visibility: true,
      isPinned: true,
      publishedAt: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">ข่าว/ประกาศ</h1>
        <div className="flex items-center gap-2">
          <Link href="/resident/news/requests">
            <Button size="sm" variant="outline">คำขอของฉัน</Button>
          </Link>
          <Link href="/resident/news/requests/new">
            <Button size="sm">
              <FilePlus2 className="h-4 w-4 mr-1" /> ขอเพิ่มข่าว
            </Button>
          </Link>
        </div>
      </div>

      {newsList.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="ยังไม่มีข่าว"
          description="ข่าวที่เผยแพร่แล้วจะแสดงที่นี่"
        />
      ) : (
        <div className="space-y-4">
          {newsList.map((news) => (
            <Link
              key={news.id}
              href={`/resident/news/${news.id}`}
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {news.isPinned && (
                      <span className="text-[11px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                        ปักหมุด
                      </span>
                    )}
                    <Badge variant="outline">{NEWS_VISIBILITY_LABELS[news.visibility]}</Badge>
                  </div>
                  <p className="font-medium text-gray-900 line-clamp-1">{news.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{news.summary || "-"}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {(news.publishedAt ?? news.createdAt).toLocaleDateString("th-TH")}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

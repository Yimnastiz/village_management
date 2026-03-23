import Link from "next/link";
import { BookmarkCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { NEWS_VISIBILITY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";

export default async function SavedPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/auth/login");

  const savedNews = await prisma.savedItem.findMany({
    where: {
      userId: session.id,
      newsId: { not: null },
      news: {
        villageId: membership.villageId,
        stage: "PUBLISHED",
        visibility: { in: ["PUBLIC", "RESIDENT_ONLY"] },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      news: {
        select: {
          id: true,
          title: true,
          summary: true,
          visibility: true,
          publishedAt: true,
          createdAt: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">รายการที่บันทึก</h1>

      {savedNews.length === 0 ? (
        <EmptyState
          icon={BookmarkCheck}
          title="ยังไม่มีรายการที่บันทึก"
          description="กดบันทึกข่าวจากหน้าข่าวเพื่อกลับมาอ่านภายหลัง"
        />
      ) : (
        <div className="space-y-3">
          {savedNews.map((item) => (
            <Link
              key={item.id}
              href={`/resident/news/${item.news?.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 line-clamp-1">{item.news?.title}</p>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.news?.summary || "-"}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {(item.news?.publishedAt ?? item.news?.createdAt)?.toLocaleDateString("th-TH")}
                  </p>
                </div>
                <Badge variant="outline">{NEWS_VISIBILITY_LABELS[item.news?.visibility ?? "PUBLIC"]}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

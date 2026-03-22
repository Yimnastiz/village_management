import Link from "next/link";
import { Newspaper, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NEWS_STAGE_LABELS, NEWS_VISIBILITY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

const stageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  DRAFT: "warning",
  PUBLISHED: "success",
  ARCHIVED: "default",
};

export default async function AdminNewsPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const newsList = await prisma.news.findMany({
    where: { villageId: membership.villageId },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      summary: true,
      stage: true,
      visibility: true,
      isPinned: true,
      authorId: true,
      publishedAt: true,
      createdAt: true,
      author: {
        select: { name: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">จัดการข่าว</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/news/requests">
            <Button size="sm" variant="outline">คำขอข่าวจากลูกบ้าน</Button>
          </Link>
          <Link href="/admin/news/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> เพิ่มข่าว
            </Button>
          </Link>
        </div>
      </div>

      {newsList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Newspaper className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">ยังไม่มีข่าวในระบบ</p>
        </div>
      ) : (
        <div className="space-y-3">
          {newsList.map((news) => (
            <Link
              key={news.id}
              href={`/admin/news/${news.id}`}
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {news.isPinned && (
                      <span className="text-[11px] rounded-full bg-yellow-100 text-yellow-700 px-2 py-0.5">
                        ปักหมุด
                      </span>
                    )}
                    <Badge variant={stageVariant[news.stage] ?? "default"}>
                      {NEWS_STAGE_LABELS[news.stage]}
                    </Badge>
                    <Badge variant="outline">{NEWS_VISIBILITY_LABELS[news.visibility]}</Badge>
                  </div>
                  <p className="font-medium text-gray-900 line-clamp-1">{news.title}</p>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                    {news.summary || "-"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    ผู้สร้าง: {news.author?.name || (news.authorId ? "ผู้ใช้ที่ไม่พบข้อมูล" : "ไม่ระบุ")}
                  </p>
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap">
                  {(news.publishedAt ?? news.createdAt).toLocaleDateString("th-TH")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

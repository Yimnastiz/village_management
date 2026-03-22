import { notFound, redirect } from "next/navigation";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { NewsRequestForm } from "../../requests/request-form";

interface PageProps {
  params: Promise<{ newsId: string }>;
}

export default async function ResidentEditNewsRequestPage({ params }: PageProps) {
  const { newsId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const news = await prisma.news.findFirst({
    where: {
      id: newsId,
      villageId: membership.villageId,
      stage: "PUBLISHED",
      visibility: { in: ["PUBLIC", "RESIDENT_ONLY"] },
    },
  });
  if (!news) notFound();

  const imageUrls = Array.isArray(news.imageUrls)
    ? news.imageUrls.map((value) => String(value)).filter((url) => url.length > 0)
    : [];

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ส่งคำขอแก้ไขข่าว</h1>
        <p className="text-sm text-gray-500 mt-1">ข่าว: {news.title}</p>
      </div>
      <NewsRequestForm
        mode="update"
        targetNewsId={news.id}
        defaultValues={{
          title: news.title,
          summary: news.summary || "",
          content: news.content,
          imageUrls,
          visibility: news.visibility,
          stage: news.stage,
          isPinned: news.isPinned,
        }}
      />
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { NewsForm } from "../../news-form";

interface PageProps {
  params: Promise<{ newsId: string }>;
}

export default async function EditNewsPage({ params }: PageProps) {
  const { newsId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const news = await prisma.news.findFirst({
    where: { id: newsId, villageId: membership.villageId },
  });
  if (!news) notFound();

  const images = (Array.isArray(news.imageUrls) ? news.imageUrls.map((value) => String(value)).filter(Boolean) : []).map((url, sortOrder) => ({ url, sortOrder, isCover: news.coverUrl ? url === news.coverUrl : sortOrder === 0 }));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-1 sm:px-0">
      <div className="flex items-center gap-3">
        <Link href={`/admin/news/${newsId}`} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">แก้ไขข่าว</h1>
      </div>
      <NewsForm
        mode="edit"
        newsId={newsId}
        stage={news.stage}
        defaultValues={{
          title: news.title,
          summary: news.summary ?? "",
          content: news.content,
          images,
          visibility: news.visibility,
          isPinned: news.isPinned,
        }}
      />
    </div>
  );
}

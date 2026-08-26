import { notFound, redirect } from "next/navigation";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { PageBackLink } from "@/components/ui/page-back-link";
import { NewsRequestForm } from "../../requests/request-form";
import { newsDetailHref, readResidentNewsContext } from "@/lib/resident-news-navigation";

interface PageProps {
  params: Promise<{ newsId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ResidentEditNewsRequestPage({ params, searchParams }: PageProps) {
  const { newsId } = await params;
  const context = readResidentNewsContext(await searchParams);
  const detailHref = newsDetailHref(newsId, context);

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/resident/dashboard");

  const news = await prisma.news.findFirst({
    where: {
      id: newsId,
      villageId: membership.villageId,
      stage: "PUBLISHED",
      visibility: { in: ["PUBLIC", "RESIDENT_ONLY"] },
      authorId: session.id,
    },
  });
  if (!news) notFound();

  const imageUrls = Array.isArray(news.imageUrls)
    ? news.imageUrls.map((value) => String(value)).filter((url) => url.length > 0)
    : [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 sm:space-y-5">
      <PageBackLink href={detailHref} label="กลับรายละเอียดข่าว" />
      <NewsRequestForm
        mode="update"
        targetNewsId={news.id}
        cancelHref={detailHref}
        successHref={detailHref}
        defaultValues={{
          title: news.title,
          summary: news.summary || "",
          content: news.content,
          imageUrls,
          coverUrl: news.coverUrl,
          visibility: news.visibility,
          stage: news.stage,
          isPinned: news.isPinned,
        }}
      />
    </div>
  );
}

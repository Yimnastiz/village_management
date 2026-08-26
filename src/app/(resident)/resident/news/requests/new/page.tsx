import { redirect } from "next/navigation";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { NewsRequestForm } from "../request-form";
import { newsDetailHref, newsListHref, readResidentNewsContext, requestListHref } from "@/lib/resident-news-navigation";
import { PageBackLink } from "@/components/ui/page-back-link";

interface PageProps {
  searchParams?: Promise<Record<string, string | undefined>>;
}

export default async function ResidentCreateNewsRequestPage({ searchParams }: PageProps) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");

  const params = (searchParams ? await searchParams : {}) ?? {};
  const context = readResidentNewsContext(params);
  const newsId = params.newsId?.trim();

  let targetNews = null;
  if (newsId) {
    targetNews = await prisma.news.findFirst({
      where: {
        id: newsId,
        authorId: session.id,
        villageId: membership.villageId,
        stage: "PUBLISHED",
      },
    });
  }

  const cancelHref = targetNews ? newsDetailHref(targetNews.id, context) : context?.from === "requests-pending" || context?.from === "requests-history" || context?.from === "requests-published" ? requestListHref(context) : newsListHref(context);

  const defaultValues = targetNews
    ? {
        title: targetNews.title,
        summary: targetNews.summary || "",
        content: targetNews.content,
        imageUrls: Array.isArray(targetNews.imageUrls)
          ? targetNews.imageUrls.map((value) => String(value)).filter((url) => url.length > 0)
          : [],
        coverUrl: targetNews.coverUrl,
        visibility: targetNews.visibility,
        stage: targetNews.stage,
        isPinned: targetNews.isPinned,
      }
    : undefined;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <PageBackLink href={cancelHref} label={targetNews ? "กลับรายละเอียดข่าว" : context?.from === "news-list" ? "กลับข่าวสาร" : "กลับรายการคำขอ"} />
      <NewsRequestForm
        mode={targetNews ? "update" : "create"}
        targetNewsId={targetNews?.id}
        cancelHref={cancelHref}
        successHref={targetNews ? requestListHref(context) : requestListHref(context)}
        defaultValues={defaultValues}
      />
    </div>
  );
}

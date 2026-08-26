import { redirect } from "next/navigation";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { NewsRequestForm } from "../request-form";

interface PageProps {
  searchParams?: Promise<{ newsId?: string }>;
}

export default async function ResidentCreateNewsRequestPage({ searchParams }: PageProps) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");

  const params = (searchParams ? await searchParams : {}) ?? {};
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
      <NewsRequestForm
        mode={targetNews ? "update" : "create"}
        targetNewsId={targetNews?.id}
        defaultValues={defaultValues}
      />
    </div>
  );
}

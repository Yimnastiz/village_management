import { Prisma } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { NewsRequestForm } from "../../request-form";
import { readResidentNewsContext, requestDetailHref } from "@/lib/resident-news-navigation";
import { PageBackLink } from "@/components/ui/page-back-link";

interface PageProps {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ResidentEditNewsSubmissionPage({ params, searchParams }: PageProps) {
  const { requestId } = await params;
  const context = readResidentNewsContext(await searchParams);
  const detailHref = requestDetailHref(requestId, context);

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");

  const request = await prisma.newsSubmission.findFirst({
    where: {
      id: requestId,
      requesterId: session.id,
      villageId: membership.villageId,
      status: "PENDING",
    },
  });

  if (!request) notFound();

  const payload = request.payload as Prisma.JsonObject;
  if (payload.isDeleteRequest === true) notFound();
  const imageUrls = Array.isArray(payload.imageUrls)
    ? payload.imageUrls.map((value) => String(value)).filter((url) => url.length > 0)
    : [];

  return (
    <div className="max-w-3xl space-y-4">
      <PageBackLink href={detailHref} label="กลับรายละเอียดคำขอ" />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">แก้ไขคำขอข่าว</h1>
        <p className="text-sm text-gray-500 mt-1">คุณสามารถแก้ไขได้เฉพาะคำขอที่ยังรออนุมัติ</p>
      </div>

      <NewsRequestForm
        mode="submission-edit"
        submissionId={request.id}
        cancelHref={detailHref}
        successHref={detailHref}
        defaultValues={{
          title: String(payload.title ?? ""),
          summary: String(payload.summary ?? ""),
          content: String(payload.content ?? ""),
          imageUrls,
          coverUrl: payload.coverUrl ? String(payload.coverUrl) : null,
          visibility: typeof payload.visibility === "string" ? payload.visibility : "",
          stage: String(payload.stage ?? "DRAFT"),
          isPinned: Boolean(payload.isPinned),
        }}
      />
    </div>
  );
}

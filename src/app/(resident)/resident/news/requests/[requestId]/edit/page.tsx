import { Prisma } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { NewsRequestForm } from "../../request-form";

interface PageProps {
  params: Promise<{ requestId: string }>;
}

export default async function ResidentEditNewsSubmissionPage({ params }: PageProps) {
  const { requestId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const request = await prisma.newsSubmission.findFirst({
    where: {
      id: requestId,
      requesterId: session.id,
      status: "PENDING",
    },
  });

  if (!request) notFound();

  const payload = request.payload as Prisma.JsonObject;
  const imageUrls = Array.isArray(payload.imageUrls)
    ? payload.imageUrls.map((value) => String(value)).filter((url) => url.length > 0)
    : [];

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">แก้ไขคำขอข่าว</h1>
        <p className="text-sm text-gray-500 mt-1">คุณสามารถแก้ไขได้เฉพาะคำขอที่ยังรออนุมัติ</p>
      </div>

      <NewsRequestForm
        mode="submission-edit"
        submissionId={request.id}
        defaultValues={{
          title: String(payload.title ?? ""),
          summary: String(payload.summary ?? ""),
          content: String(payload.content ?? ""),
          imageUrls,
          visibility: String(payload.visibility ?? "PUBLIC"),
          stage: String(payload.stage ?? "DRAFT"),
          isPinned: Boolean(payload.isPinned),
        }}
      />
    </div>
  );
}

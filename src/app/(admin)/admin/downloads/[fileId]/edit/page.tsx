import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { DownloadForm } from "../../download-form";
import { DOWNLOAD_CATEGORY_LABELS } from "@/lib/downloads/constants";

interface PageProps {
  params: Promise<{ fileId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { fileId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const file = await prisma.downloadFile.findFirst({
    where: { id: fileId, villageId: membership.villageId },
    include: { attachments: { orderBy: { sortOrder: "asc" } } },
  });
  if (!file) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4" data-admin-compact-top>
      <div className="flex items-center">
        <Link href={`/admin/downloads/${file.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" />
          <span>กลับรายละเอียดเอกสาร</span>
        </Link>
      </div>
      <DownloadForm
        mode="edit"
        fileId={file.id}
        defaultValues={{
          title: file.title,
          description: file.description || "",
          category: file.category && file.category in DOWNLOAD_CATEGORY_LABELS ? file.category : "OTHER",
          categoryLabel: file.category === "OTHER" ? file.categoryLabel : (file.category && !(file.category in DOWNLOAD_CATEGORY_LABELS) ? file.category : null),
          visibility: file.visibility,
        }}
        initialAttachments={file.attachments}
      />
    </div>
  );
}

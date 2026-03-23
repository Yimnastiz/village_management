import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { NEWS_VISIBILITY_LABELS } from "@/lib/constants";
import { formatFileSize } from "@/lib/utils";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{ fileId: string }>;
}

export default async function ResidentDownloadDetailPage({ params }: PageProps) {
  const { fileId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/auth/login");

  const file = await prisma.downloadFile.findFirst({
    where: {
      id: fileId,
      villageId: membership.villageId,
      stage: "PUBLISHED",
      visibility: { in: ["PUBLIC", "RESIDENT_ONLY"] },
    },
  });
  if (!file) notFound();

  await prisma.downloadFile.update({
    where: { id: file.id },
    data: { downloadCount: { increment: 1 } },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/resident/downloads" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> กลับรายการเอกสาร
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">{file.title}</h1>
        <p className="text-sm text-gray-500">{NEWS_VISIBILITY_LABELS[file.visibility]}</p>
        {file.description && <p className="text-gray-600">{file.description}</p>}

        <div className="text-sm text-gray-500 space-y-1">
          <p>หมวดหมู่: {file.category || "ทั่วไป"}</p>
          <p>ชื่อไฟล์: {file.fileKey || "-"}</p>
          <p>ขนาดไฟล์: {file.fileSize != null ? formatFileSize(file.fileSize) : "-"}</p>
        </div>

        {file.fileUrl ? (
          <a
            href={file.fileUrl}
            download={file.fileKey || file.title}
            className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            ดาวน์โหลดเอกสาร
          </a>
        ) : (
          <p className="text-sm text-red-600">ยังไม่มีไฟล์แนบ</p>
        )}
      </div>
    </div>
  );
}

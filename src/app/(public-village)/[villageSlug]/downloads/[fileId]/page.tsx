import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { formatFileSize } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{ villageSlug: string; fileId: string }>;
}

export default async function DownloadDetailPage({ params }: PageProps) {
  const { villageSlug, fileId } = await params;

  const village = await prisma.village.findUnique({
    where: { slug: villageSlug },
    select: { id: true, slug: true },
  });
  if (!village) notFound();

  const file = await prisma.downloadFile.findFirst({
    where: {
      id: fileId,
      villageId: village.id,
      stage: "PUBLISHED",
      visibility: "PUBLIC",
    },
  });
  if (!file) notFound();

  await prisma.downloadFile.update({
    where: { id: file.id },
    data: { downloadCount: { increment: 1 } },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href={`/${village.slug}/downloads`}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> กลับรายการเอกสาร
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">{file.title}</h1>
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

import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DOWNLOAD_STAGE_LABELS, NEWS_VISIBILITY_LABELS } from "@/lib/constants";
import { formatFileSize } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { DownloadDeleteButton } from "./delete-button";

interface PageProps {
  params: Promise<{ fileId: string }>;
}

const stageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  DRAFT: "warning",
  PUBLISHED: "success",
  ARCHIVED: "default",
};

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
  });
  if (!file) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/admin/downloads" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> กลับรายการเอกสาร
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/admin/downloads/${file.id}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="h-4 w-4 mr-1" /> แก้ไข
            </Button>
          </Link>
          <DownloadDeleteButton fileId={file.id} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant={stageVariant[file.stage] ?? "default"}>{DOWNLOAD_STAGE_LABELS[file.stage]}</Badge>
          <Badge variant="outline">{NEWS_VISIBILITY_LABELS[file.visibility]}</Badge>
          {file.category && <Badge variant="outline">{file.category}</Badge>}
        </div>

        <h1 className="text-2xl font-bold text-gray-900">{file.title}</h1>
        {file.description && <p className="text-gray-600">{file.description}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">ชื่อไฟล์</p>
            <p className="text-gray-900 mt-1">{file.fileKey || "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">ขนาดไฟล์</p>
            <p className="text-gray-900 mt-1">{file.fileSize != null ? formatFileSize(file.fileSize) : "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">ประเภทไฟล์</p>
            <p className="text-gray-900 mt-1">{file.mimeType || "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">จำนวนดาวน์โหลด</p>
            <p className="text-gray-900 mt-1">{file.downloadCount} ครั้ง</p>
          </div>
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

import Link from "next/link";
import { Files, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DOWNLOAD_STAGE_LABELS, NEWS_VISIBILITY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

const stageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  DRAFT: "warning",
  PUBLISHED: "success",
  ARCHIVED: "default",
};

export default async function Page() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const files = await prisma.downloadFile.findMany({
    where: { villageId: membership.villageId },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      stage: true,
      visibility: true,
      fileKey: true,
      fileSize: true,
      downloadCount: true,
      createdAt: true,
      publishedAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">เอกสารดาวน์โหลด</h1>
        <Link href="/admin/downloads/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> เพิ่มเอกสาร
          </Button>
        </Link>
      </div>

      {files.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Files className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">ยังไม่มีเอกสาร</p>
        </div>
      ) : (
        <div className="space-y-3">
          {files.map((file) => (
            <Link
              key={file.id}
              href={`/admin/downloads/${file.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={stageVariant[file.stage] ?? "default"}>
                      {DOWNLOAD_STAGE_LABELS[file.stage]}
                    </Badge>
                    <Badge variant="outline">{NEWS_VISIBILITY_LABELS[file.visibility]}</Badge>
                    {file.category && <Badge variant="outline">{file.category}</Badge>}
                  </div>
                  <p className="font-medium text-gray-900 line-clamp-1">{file.title}</p>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{file.description || "-"}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    ไฟล์: {file.fileKey || "-"} • ดาวน์โหลด {file.downloadCount} ครั้ง
                  </p>
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap">
                  {(file.publishedAt ?? file.createdAt).toLocaleDateString("th-TH")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

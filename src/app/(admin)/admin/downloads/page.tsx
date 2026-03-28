import Link from "next/link";
import { Files, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { DOWNLOAD_STAGE_LABELS, NEWS_VISIBILITY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

type PageProps = {
  searchParams?: Promise<{ q?: string; stage?: string; visibility?: string; sort?: string }>;
};

const stageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  DRAFT: "warning",
  PUBLISHED: "success",
  ARCHIVED: "default",
};

export default async function Page({ searchParams }: PageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const keyword = params.q?.trim() ?? "";
  const activeStage = params.stage ?? "ALL";
  const activeVisibility = params.visibility ?? "ALL";
  const activeSort = params.sort ?? "newest";

  const where: Prisma.DownloadFileWhereInput = { villageId: membership.villageId };
  if (activeStage !== "ALL") {
    where.stage = activeStage as Prisma.DownloadFileWhereInput["stage"];
  }
  if (activeVisibility !== "ALL") {
    where.visibility = activeVisibility as Prisma.DownloadFileWhereInput["visibility"];
  }
  if (keyword) {
    where.OR = [
      { title: { contains: keyword, mode: "insensitive" } },
      { description: { contains: keyword, mode: "insensitive" } },
      { category: { contains: keyword, mode: "insensitive" } },
    ];
  }

  const orderBy =
    activeSort === "oldest"
      ? [{ createdAt: "asc" as const }]
      : activeSort === "downloads"
        ? [{ downloadCount: "desc" as const }, { createdAt: "desc" as const }]
        : [{ createdAt: "desc" as const }];

  const files = await prisma.downloadFile.findMany({
    where,
    orderBy,
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

  const suggestionTitles = Array.from(new Set(files.map((file) => file.title))).slice(0, 12);

  function buildDownloadsHref(next: { q?: string; stage?: string; visibility?: string; sort?: string }) {
    const query = new URLSearchParams();
    const q = next.q?.trim() ?? "";
    const stage = next.stage ?? "ALL";
    const visibility = next.visibility ?? "ALL";
    const sort = next.sort ?? "newest";
    if (q) query.set("q", q);
    if (stage !== "ALL") query.set("stage", stage);
    if (visibility !== "ALL") query.set("visibility", visibility);
    if (sort !== "newest") query.set("sort", sort);
    const queryString = query.toString();
    return queryString ? `/admin/downloads?${queryString}` : "/admin/downloads";
  }

  return (
    <div className="space-y-6">
      <AdminListToolbar
        title="เอกสารดาวน์โหลด"
        description="ค้นหาเอกสาร กรองตามสถานะและการมองเห็น และดูไฟล์ยอดดาวน์โหลดสูง"
        searchAction="/admin/downloads"
        keyword={keyword}
        searchPlaceholder="ค้นหาชื่อเอกสาร รายละเอียด หรือหมวดหมู่"
        hiddenInputs={{ stage: activeStage === "ALL" ? "" : activeStage, visibility: activeVisibility === "ALL" ? "" : activeVisibility, sort: activeSort === "newest" ? "" : activeSort }}
        suggestionTitles={suggestionTitles}
        groups={[
          {
            label: "สถานะ",
            options: [
              { label: "ทั้งหมด", href: buildDownloadsHref({ q: keyword, stage: "ALL", visibility: activeVisibility, sort: activeSort }), active: activeStage === "ALL" },
              { label: "ร่าง", href: buildDownloadsHref({ q: keyword, stage: "DRAFT", visibility: activeVisibility, sort: activeSort }), active: activeStage === "DRAFT" },
              { label: "เผยแพร่", href: buildDownloadsHref({ q: keyword, stage: "PUBLISHED", visibility: activeVisibility, sort: activeSort }), active: activeStage === "PUBLISHED" },
              { label: "เก็บถาวร", href: buildDownloadsHref({ q: keyword, stage: "ARCHIVED", visibility: activeVisibility, sort: activeSort }), active: activeStage === "ARCHIVED" },
            ],
          },
          {
            label: "การมองเห็น",
            options: [
              { label: "ทั้งหมด", href: buildDownloadsHref({ q: keyword, stage: activeStage, visibility: "ALL", sort: activeSort }), active: activeVisibility === "ALL" },
              { label: "สาธารณะ", href: buildDownloadsHref({ q: keyword, stage: activeStage, visibility: "PUBLIC", sort: activeSort }), active: activeVisibility === "PUBLIC" },
              { label: "ลูกบ้าน", href: buildDownloadsHref({ q: keyword, stage: activeStage, visibility: "RESIDENT_ONLY", sort: activeSort }), active: activeVisibility === "RESIDENT_ONLY" },
            ],
          },
          {
            label: "เรียง",
            options: [
              { label: "ล่าสุดก่อน", href: buildDownloadsHref({ q: keyword, stage: activeStage, visibility: activeVisibility, sort: "newest" }), active: activeSort === "newest" },
              { label: "เก่าก่อน", href: buildDownloadsHref({ q: keyword, stage: activeStage, visibility: activeVisibility, sort: "oldest" }), active: activeSort === "oldest" },
              { label: "ดาวน์โหลดสูง", href: buildDownloadsHref({ q: keyword, stage: activeStage, visibility: activeVisibility, sort: "downloads" }), active: activeSort === "downloads" },
            ],
          },
        ]}
        actions={
          <Link href="/admin/downloads/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> เพิ่มเอกสาร
            </Button>
          </Link>
        }
      />

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

import Link from "next/link";
import { Files, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { DownloadMetadata } from "@/components/downloads/download-metadata";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { DOWNLOAD_CATEGORY_OPTIONS, DOWNLOAD_STAGE_LABELS } from "@/lib/downloads/constants";
import { formatFileSize } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

type PageProps = { searchParams?: Promise<{ q?: string; stage?: string; category?: string; visibility?: string; sort?: string }> };
const stageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = { DRAFT: "warning", PUBLISHED: "success", ARCHIVED: "default" };
const STAGE_PRIORITY: Record<string, number> = { DRAFT: 0, PUBLISHED: 1, ARCHIVED: 2 };

export default async function Page({ searchParams }: PageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");
  const membership = await prisma.villageMembership.findFirst({ where: { userId: session.id, status: "ACTIVE" }, select: { villageId: true } });
  if (!membership) redirect("/auth/login");

  const keyword = params.q?.trim() ?? "";
  const activeStage = params.stage ?? "ALL";
  const activeCategory = params.category ?? "ALL";
  const activeVisibility = params.visibility ?? "ALL";
  const activeSort = params.sort ?? "newest";
  const where: Prisma.DownloadFileWhereInput = { villageId: membership.villageId };
  if (["DRAFT", "PUBLISHED", "ARCHIVED"].includes(activeStage)) where.stage = activeStage as Prisma.DownloadFileWhereInput["stage"];
  if (DOWNLOAD_CATEGORY_OPTIONS.some((option) => option.value === activeCategory)) where.category = activeCategory;
  if (["PUBLIC", "RESIDENT_ONLY"].includes(activeVisibility)) where.visibility = activeVisibility as Prisma.DownloadFileWhereInput["visibility"];
  if (keyword) where.OR = [{ title: { contains: keyword, mode: "insensitive" } }, { description: { contains: keyword, mode: "insensitive" } }, { categoryLabel: { contains: keyword, mode: "insensitive" } }];

  const [files, suggestions] = await Promise.all([
    prisma.downloadFile.findMany({ where, select: { id: true, title: true, description: true, category: true, categoryLabel: true, stage: true, visibility: true, downloadCount: true, createdAt: true, publishedAt: true, attachments: { select: { fileSize: true } } } }),
    prisma.downloadFile.findMany({ where: { villageId: membership.villageId }, orderBy: { updatedAt: "desc" }, take: 50, select: { title: true } }),
  ]);

  const sortedFiles = [...files].sort((a, b) => {
    const priorityDiff = (activeStage === "ALL" ? STAGE_PRIORITY[a.stage] - STAGE_PRIORITY[b.stage] : 0);
    if (priorityDiff !== 0) return priorityDiff;

    const getDateValue = (file: { publishedAt: Date | null; createdAt: Date }) => new Date(file.publishedAt ?? file.createdAt).getTime();
    if (activeSort === "oldest") return getDateValue(a) - getDateValue(b);
    if (activeSort === "downloads") {
      const downloadDiff = (b.downloadCount ?? 0) - (a.downloadCount ?? 0);
      if (downloadDiff !== 0) return downloadDiff;
      return getDateValue(b) - getDateValue(a);
    }
    return getDateValue(b) - getDateValue(a);
  });

  const suggestionTitles = Array.from(new Set(suggestions.map((file) => file.title))).slice(0, 12);
  const href = (next: { q?: string; stage?: string; category?: string; visibility?: string; sort?: string }) => {
    const query = new URLSearchParams(); const values = { q: next.q?.trim() ?? "", stage: next.stage ?? "ALL", category: next.category ?? "ALL", visibility: next.visibility ?? "ALL", sort: next.sort ?? "newest" };
    if (values.q) query.set("q", values.q); if (values.stage !== "ALL") query.set("stage", values.stage); if (values.category !== "ALL") query.set("category", values.category); if (values.visibility !== "ALL") query.set("visibility", values.visibility); if (values.sort !== "newest") query.set("sort", values.sort);
    return query.size ? `/admin/downloads?${query}` : "/admin/downloads";
  };
  const optionGroup = (label: string, entries: Array<[string, string]>, key: "stage" | "category" | "visibility" | "sort", active: string) => ({ label, options: entries.map(([value, text]) => ({ label: text, href: href({ q: keyword, stage: key === "stage" ? value : activeStage, category: key === "category" ? value : activeCategory, visibility: key === "visibility" ? value : activeVisibility, sort: key === "sort" ? value : activeSort }), active: active === value })) });
  const filtered = Boolean(keyword || activeStage !== "ALL" || activeCategory !== "ALL" || activeVisibility !== "ALL" || activeSort !== "newest");

  return <div data-admin-compact-top className="space-y-3">
    <AdminListToolbar sticky title="เอกสารดาวน์โหลด" description="ค้นหาและจัดการเอกสารของหมู่บ้าน" searchAction="/admin/downloads" clearHref="/admin/downloads" keyword={keyword} searchPlaceholder="ค้นหาชื่อเอกสารหรือรายละเอียด" hiddenInputs={{ stage: activeStage === "ALL" ? "" : activeStage, category: activeCategory === "ALL" ? "" : activeCategory, visibility: activeVisibility === "ALL" ? "" : activeVisibility, sort: activeSort === "newest" ? "" : activeSort }} suggestionTitles={suggestionTitles} groups={[optionGroup("สถานะ", [["ALL", "ทั้งหมด"], ["DRAFT", "ร่าง"], ["PUBLISHED", "เผยแพร่"], ["ARCHIVED", "จัดเก็บ"]], "stage", activeStage), optionGroup("หมวดหมู่", [["ALL", "ทั้งหมด"], ...DOWNLOAD_CATEGORY_OPTIONS.map((option) => [option.value, option.label] as [string, string])], "category", activeCategory), optionGroup("การมองเห็น", [["ALL", "ทั้งหมด"], ["PUBLIC", "สาธารณะ"], ["RESIDENT_ONLY", "เฉพาะลูกบ้าน"]], "visibility", activeVisibility), optionGroup("เรียงลำดับ", [["newest", "ล่าสุดก่อน"], ["oldest", "เก่าก่อน"], ["downloads", "ดาวน์โหลดสูง"]], "sort", activeSort)]} actions={<Link href="/admin/downloads/new" className="inline-flex min-h-9 items-center justify-center rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"><Plus className="mr-1 h-4 w-4" />เพิ่มเอกสาร</Link>} />
    {sortedFiles.length === 0 ? <div className="rounded-xl border border-gray-200 bg-white p-10 text-center"><Files className="mx-auto mb-3 h-10 w-10 text-gray-300" /><p className="text-gray-700">{filtered ? "ไม่พบเอกสารที่ตรงกับเงื่อนไข" : "ยังไม่มีเอกสาร"}</p>{filtered ? <p className="mt-1 text-sm text-gray-500">ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p> : null}</div> : <div className="space-y-2">{sortedFiles.map((file) => { const totalSize = file.attachments.reduce((total, item) => total + item.fileSize, 0); const documentDate = (file.publishedAt ?? file.createdAt).toLocaleDateString("th-TH"); return <Link key={file.id} href={`/admin/downloads/${file.id}`} className="block rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="mb-2"><Badge variant={stageVariant[file.stage] ?? "default"}>{DOWNLOAD_STAGE_LABELS[file.stage]}</Badge></div><p className="break-words text-base font-semibold text-gray-900">{file.title}</p>{file.description ? <p className="mt-1 line-clamp-2 break-words text-sm text-gray-500">{file.description}</p> : null}</div><time className="shrink-0 text-right text-[11px] font-medium text-gray-400 sm:text-xs">{documentDate}</time></div><div className="mt-3"><DownloadMetadata visibility={file.visibility} category={file.category} categoryLabel={file.categoryLabel} attachmentCount={file.attachments.length} totalSize={formatFileSize(totalSize)} downloadCount={file.downloadCount} /></div></Link>; })}</div>}
  </div>;
}

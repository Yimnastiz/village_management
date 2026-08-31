import Link from "next/link";
import { Newspaper, Plus } from "lucide-react";
import { Prisma } from "@prisma/client";
import { NewsCard } from "@/components/news/news-card";
import { NewsMetadata } from "@/components/news/news-metadata";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { formatNewsAuthor } from "@/lib/news-author";

function href(villageId: string, q: string, stage: string, visibility: string, sort: string) { const params = new URLSearchParams(); if (q) params.set("q", q); if (stage !== "ALL") params.set("stage", stage); if (visibility !== "ALL") params.set("visibility", visibility); if (sort !== "newest") params.set("sort", sort); const query = params.toString(); return `/superadmin/villages/${villageId}/news${query ? `?${query}` : ""}`; }

export default async function SuperAdminVillageNewsPage({ params, searchParams }: { params: Promise<{ villageId: string }>; searchParams: Promise<{ q?: string; stage?: string; visibility?: string; sort?: string }> }) {
  const { villageId } = await params; const query = await searchParams; const keyword = query.q?.trim() ?? ""; const stage = query.stage ?? "ALL"; const visibility = query.visibility ?? "ALL"; const sort = query.sort ?? "newest";
  const village = await prisma.village.findUnique({ where: { id: villageId }, select: { name: true } });
  const where: Prisma.NewsWhereInput = { villageId };
  if (keyword) where.OR = [{ title: { contains: keyword, mode: "insensitive" } }, { summary: { contains: keyword, mode: "insensitive" } }, { content: { contains: keyword, mode: "insensitive" } }];
  if (["DRAFT", "PUBLISHED", "ARCHIVED"].includes(stage)) where.stage = stage as "DRAFT" | "PUBLISHED" | "ARCHIVED";
  if (["PUBLIC", "RESIDENT_ONLY"].includes(visibility)) where.visibility = visibility as "PUBLIC" | "RESIDENT_ONLY";
  const rows = await prisma.news.findMany({ where, orderBy: [{ isPinned: "desc" }, { createdAt: sort === "oldest" ? "asc" : "desc" }], select: { id: true, title: true, summary: true, coverUrl: true, imageUrls: true, stage: true, visibility: true, isPinned: true, publishedAt: true, createdAt: true, author: { select: { name: true, systemRole: true, memberships: { where: { villageId, status: "ACTIVE" }, select: { role: true } } } } } });
  const suggestions = Array.from(new Set(rows.map((row) => row.title))).slice(0, 12);
  const groups = [{ label: "สถานะ", values: [["ALL", "ทั้งหมด"], ["DRAFT", "ร่าง"], ["PUBLISHED", "เผยแพร่"], ["ARCHIVED", "จัดเก็บแล้ว"]] }, { label: "การมองเห็น", values: [["ALL", "ทั้งหมด"], ["PUBLIC", "สาธารณะ"], ["RESIDENT_ONLY", "ลูกบ้าน"]] }, { label: "เรียง", values: [["newest", "ล่าสุด"], ["oldest", "เก่าสุด"]] }];
  return <div className="space-y-4"><SuperAdminPageHeaderRegistration context={{ title: "ข่าวสาร", description: `จัดการข่าวสารและประกาศของ ${village?.name ?? "หมู่บ้าน"} เพื่อการสนับสนุนงานหมู่บ้าน` }} /><AdminListToolbar sticky title="ข่าวสาร" description="ค้นหาและกรองข่าวตามสถานะและการมองเห็น" searchAction={`/superadmin/villages/${villageId}/news`} clearHref={`/superadmin/villages/${villageId}/news`} keyword={keyword} searchPlaceholder="ค้นหาชื่อหรือเนื้อหาข่าว" searchLabel="ค้นหาข่าว" suggestionTitles={suggestions} groups={groups.map((group, groupIndex) => ({ label: group.label, options: group.values.map(([value, label], index) => ({ label, href: href(villageId, keyword, groupIndex === 0 ? value : stage, groupIndex === 1 ? value : visibility, groupIndex === 2 ? value : sort), active: (groupIndex === 0 ? stage : groupIndex === 1 ? visibility : sort) === value, isDefault: index === 0 })) }))} actions={<Link href={`/superadmin/villages/${villageId}/news/new`}><Button size="sm" className="h-10 px-2 sm:px-3"><Plus className="h-4 w-4" /><span className="ml-1 hidden min-[360px]:inline">เพิ่มข่าว</span></Button></Link>} />{rows.length === 0 ? <div className="rounded-xl border border-gray-200 bg-white p-10 text-center"><Newspaper className="mx-auto mb-3 h-10 w-10 text-gray-300" /><p className="text-gray-600">ยังไม่มีข่าวตามเงื่อนไขนี้</p></div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{rows.map((news) => <NewsCard key={news.id} href={`/superadmin/villages/${villageId}/news/${news.id}`} title={news.title} summary={news.summary} imageUrl={news.coverUrl || (Array.isArray(news.imageUrls) ? String(news.imageUrls[0] ?? "") : null)} isPinned={news.isPinned} metadata={<NewsMetadata stage={news.stage} visibility={news.visibility} isPinned={news.isPinned} showPinned={false} />} meta={`${(news.publishedAt ?? news.createdAt).toLocaleDateString("th-TH")} · ${formatNewsAuthor(news.author?.name, news.author?.systemRole, news.author?.memberships[0]?.role)}`} />)}</div>}</div>;
}

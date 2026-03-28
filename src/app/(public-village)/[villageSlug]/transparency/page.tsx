import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { normalizeVillageSlugParam, getSlugVariants } from "@/lib/village-slug";
import { PublicTransparencyToolbar } from "./public-transparency-toolbar";

interface PageProps {
  params: Promise<{ villageSlug: string }>;
  searchParams?: Promise<{ q?: string; sort?: string }>;
}

export default async function TransparencyPage({ params, searchParams }: PageProps) {
  const { villageSlug: rawVillageSlug } = await params;
  const villageSlug = normalizeVillageSlugParam(rawVillageSlug);
  const query = (searchParams ? await searchParams : {}) ?? {};
  const keyword = query.q?.trim() ?? "";
  const sort = query.sort === "date_asc" ? "date_asc" : "date_desc";

  const village = await prisma.village.findFirst({
    where: { slug: { in: getSlugVariants(villageSlug) } },
    select: { id: true, name: true, slug: true },
  });
  if (!village) notFound();

  const records = await prisma.transparencyRecord.findMany({
    where: {
      villageId: village.id,
      stage: "PUBLISHED",
      visibility: "PUBLIC",
      ...(keyword
        ? {
            title: {
              contains: keyword,
              mode: "insensitive" as const,
            },
          }
        : {}),
    },
    orderBy:
      sort === "date_asc"
        ? [{ publishedAt: "asc" }, { createdAt: "asc" }]
        : [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });

  const titleSuggestions = await prisma.transparencyRecord.findMany({
    where: {
      villageId: village.id,
      stage: "PUBLISHED",
      visibility: "PUBLIC",
    },
    select: { title: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  const suggestionTitles = Array.from(new Set(titleSuggestions.map((item) => item.title))).slice(0, 20);

  return (
    <div className="space-y-6">
      <PublicTransparencyToolbar
        villageSlug={villageSlug}
        villageName={village.name}
        keyword={keyword}
        sort={sort}
        suggestionTitles={suggestionTitles}
      />

      {records.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="ยังไม่มีข้อมูลสาธารณะ"
          description="ข้อมูลที่เผยแพร่สาธารณะจะแสดงที่นี่"
        />
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <Link
              key={record.id}
              href={`/${village.slug}/transparency/${record.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 line-clamp-1">{record.title}</p>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                    {record.category || "ไม่ระบุหมวดหมู่"}
                    {record.amount != null && ` • งบประมาณ ${record.amount.toLocaleString("th-TH")} บาท`}
                  </p>
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap">
                  {(record.publishedAt ?? record.createdAt).toLocaleDateString("th-TH")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

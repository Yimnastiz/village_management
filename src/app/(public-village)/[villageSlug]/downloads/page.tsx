import Link from "next/link";
import { Files } from "lucide-react";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/prisma";
import { normalizeVillageSlugParam, getSlugVariants } from "@/lib/village-slug";
import { PublicDownloadsToolbar } from "./public-downloads-toolbar";

interface PageProps {
  params: Promise<{ villageSlug: string }>;
  searchParams?: Promise<{ q?: string; sort?: string }>;
}

export default async function DownloadsPage({ params, searchParams }: PageProps) {
  const { villageSlug: rawVillageSlug } = await params;
  const villageSlug = normalizeVillageSlugParam(rawVillageSlug);
  const query = (searchParams ? await searchParams : {}) ?? {};
  const keyword = query.q?.trim() ?? "";
  const sort = query.sort === "oldest" ? "oldest" : "newest";

  const village = await prisma.village.findFirst({
    where: { slug: { in: getSlugVariants(villageSlug) } },
    select: { id: true, name: true, slug: true },
  });
  if (!village) notFound();

  const files = await prisma.downloadFile.findMany({
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
      sort === "oldest"
        ? [{ publishedAt: "asc" }, { createdAt: "asc" }]
        : [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      publishedAt: true,
      createdAt: true,
    },
  });

  const titleSuggestions = await prisma.downloadFile.findMany({
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
      <PublicDownloadsToolbar
        villageSlug={villageSlug}
        villageName={village.name}
        keyword={keyword}
        sort={sort}
        suggestionTitles={suggestionTitles}
      />

      {files.length === 0 ? (
        <EmptyState
          icon={Files}
          title="ยังไม่มีเอกสารสาธารณะ"
          description={`เอกสารของหมู่บ้าน ${village.name} จะแสดงที่นี่`}
        />
      ) : (
        <div className="space-y-3">
          {files.map((file) => (
            <Link
              key={file.id}
              href={`/${village.slug}/downloads/${file.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
            >
              <p className="font-medium text-gray-900">{file.title}</p>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{file.description || "-"}</p>
              <p className="text-xs text-gray-400 mt-2">
                {file.category || "ทั่วไป"} • {(file.publishedAt ?? file.createdAt).toLocaleDateString("th-TH")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { Files } from "lucide-react";
import { redirect } from "next/navigation";
import { NewsVisibility } from "@prisma/client";
import { EmptyState } from "@/components/ui/empty-state";
import { DownloadMetadata } from "@/components/downloads/download-metadata";
import { getResidentVillageAccess, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { ResidentDownloadsToolbar } from "./resident-downloads-toolbar";

type ResidentDownloadsPageProps = {
  searchParams?: Promise<{ q?: string; sort?: string; visibility?: string; category?: string }>;
};

export default async function ResidentDownloadsPage({ searchParams }: ResidentDownloadsPageProps) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = await getResidentVillageAccess(session);
  if (!membership) redirect("/resident/dashboard");

  const query = (searchParams ? await searchParams : {}) ?? {};
  const keyword = query.q?.trim() ?? "";
  const category = query.category?.trim() ?? "";
  const sort = query.sort === "oldest" ? "oldest" : "newest";
  const visibilityParam = (query.visibility ?? "").trim();
  const requestedVisibilities = Array.from(
    new Set(
      visibilityParam
        .split(",")
        .map((value) => value.trim())
        .filter((value): value is "PUBLIC" | "RESIDENT_ONLY" =>
          value === "PUBLIC" || value === "RESIDENT_ONLY"
        )
    )
  );

  const selectedVisibilities = membership.hasResidentAccess ? requestedVisibilities : [];
  const visibilityWhereClause: NewsVisibility | { in: NewsVisibility[] } =
    !membership.hasResidentAccess
      ? NewsVisibility.PUBLIC
      : selectedVisibilities.length === 1
      ? selectedVisibilities[0]
      : { in: ["PUBLIC", "RESIDENT_ONLY"] };

  const files = await prisma.downloadFile.findMany({
    where: {
      villageId: membership.villageId,
      stage: "PUBLISHED",
      visibility: visibilityWhereClause,
      ...(keyword
        ? {
            title: {
              contains: keyword,
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(category ? { category } : {}),
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
      categoryLabel: true,
      visibility: true,
      publishedAt: true,
      createdAt: true,
      _count: { select: { attachments: true } },
    },
  });

  const [titleSuggestions, categoryRows] = await Promise.all([prisma.downloadFile.findMany({
    where: {
      villageId: membership.villageId,
      stage: "PUBLISHED",
      visibility: membership.hasResidentAccess ? { in: ["PUBLIC", "RESIDENT_ONLY"] } : NewsVisibility.PUBLIC,
    },
    select: { title: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  }), prisma.downloadFile.findMany({
    where: {
      villageId: membership.villageId,
      stage: "PUBLISHED",
      visibility: membership.hasResidentAccess ? { in: ["PUBLIC", "RESIDENT_ONLY"] } : NewsVisibility.PUBLIC,
      category: { not: null },
    },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  })]);
  const suggestionTitles = Array.from(new Set(titleSuggestions.map((item) => item.title))).slice(0, 20);

  return (
    <div className="space-y-6">
      <ResidentDownloadsToolbar
        keyword={keyword}
        category={category}
        categories={categoryRows.map((item) => item.category).filter((value): value is string => Boolean(value))}
        selectedVisibilities={selectedVisibilities}
        sort={sort}
        suggestionTitles={suggestionTitles}
        hasResidentAccess={membership.hasResidentAccess}
      />

      {files.length === 0 ? (
        <EmptyState
          icon={Files}
          title="ยังไม่มีเอกสาร"
          description={keyword ? "ไม่พบเอกสารตามคำค้นหรือเงื่อนไขนี้" : "เอกสารที่เผยแพร่แล้วจะแสดงที่นี่"}
        />
      ) : (
        <div className="space-y-3">
          {files.map((file) => (
            <Link
              key={file.id}
              href={`/resident/downloads/${file.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-base font-semibold text-gray-900">{file.title}</p>
                  <p className="mt-1 line-clamp-2 break-words text-sm text-gray-500">{file.description || "-"}</p>
                  <div className="mt-2">
                    <DownloadMetadata
                      visibility={file.visibility}
                      category={file.category}
                      categoryLabel={file.categoryLabel}
                      attachmentCount={file._count.attachments}
                      date={(file.publishedAt ?? file.createdAt).toLocaleDateString("th-TH")}
                    />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

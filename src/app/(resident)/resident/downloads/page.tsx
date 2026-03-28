import Link from "next/link";
import { Files } from "lucide-react";
import { redirect } from "next/navigation";
import { NewsVisibility } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { NEWS_VISIBILITY_LABELS } from "@/lib/constants";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { ResidentDownloadsToolbar } from "./resident-downloads-toolbar";

type ResidentDownloadsPageProps = {
  searchParams?: Promise<{ q?: string; sort?: string; visibility?: string }>;
};

export default async function ResidentDownloadsPage({ searchParams }: ResidentDownloadsPageProps) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/auth/login");

  const query = (searchParams ? await searchParams : {}) ?? {};
  const keyword = query.q?.trim() ?? "";
  const sort = query.sort === "oldest" ? "oldest" : "newest";
  const visibilityParam = (query.visibility ?? "").trim();
  const selectedVisibilities = Array.from(
    new Set(
      visibilityParam
        .split(",")
        .map((value) => value.trim())
        .filter((value): value is "PUBLIC" | "RESIDENT_ONLY" =>
          value === "PUBLIC" || value === "RESIDENT_ONLY"
        )
    )
  );

  const visibilityWhereClause: NewsVisibility | { in: NewsVisibility[] } =
    selectedVisibilities.length === 1
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
      visibility: true,
      publishedAt: true,
      createdAt: true,
    },
  });

  const titleSuggestions = await prisma.downloadFile.findMany({
    where: {
      villageId: membership.villageId,
      stage: "PUBLISHED",
      visibility: { in: ["PUBLIC", "RESIDENT_ONLY"] },
    },
    select: { title: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  const suggestionTitles = Array.from(new Set(titleSuggestions.map((item) => item.title))).slice(0, 20);

  return (
    <div className="space-y-6">
      <ResidentDownloadsToolbar
        keyword={keyword}
        selectedVisibilities={selectedVisibilities}
        sort={sort}
        suggestionTitles={suggestionTitles}
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
                  <div className="mb-1">
                    <Badge
                      variant="outline"
                      className={
                        file.visibility === "PUBLIC"
                          ? "border-sky-200 bg-sky-50 text-sky-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }
                    >
                      {NEWS_VISIBILITY_LABELS[file.visibility]}
                    </Badge>
                  </div>
                  <p className="font-medium text-gray-900">{file.title}</p>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{file.description || "-"}</p>
                  <p className="text-xs text-gray-400 mt-1">{file.category || "ทั่วไป"}</p>
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

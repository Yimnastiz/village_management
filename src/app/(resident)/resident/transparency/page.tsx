import Link from "next/link";
import { redirect } from "next/navigation";
import { NewsVisibility } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { NEWS_VISIBILITY_LABELS } from "@/lib/constants";
import { ResidentTransparencyToolbar } from "./resident-transparency-toolbar";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string; sort?: string; visibility?: string };

export default async function ResidentTransparencyPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/auth/login");

  const { q = "", sort = "date_desc", visibility = "" } = await searchParams;

  const visibilityTokens = visibility
    .split(",")
    .map((token) => token.trim())
    .filter((token): token is "PUBLIC" | "RESIDENT_ONLY" => token === "PUBLIC" || token === "RESIDENT_ONLY");

  const selectedVisibilities = Array.from(new Set(visibilityTokens));

  const allowedVisibility: NewsVisibility[] =
    selectedVisibilities.length === 1
      ? [selectedVisibilities[0]]
      : ["PUBLIC", "RESIDENT_ONLY"];

  const [records, suggestions] = await Promise.all([
    prisma.transparencyRecord.findMany({
      where: {
        villageId: membership.villageId,
        stage: "PUBLISHED",
        visibility: { in: allowedVisibility },
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy:
        sort === "date_asc"
          ? [{ publishedAt: "asc" }, { createdAt: "asc" }]
          : [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        category: true,
        amount: true,
        fiscalYear: true,
        visibility: true,
        publishedAt: true,
        createdAt: true,
      },
    }),
    prisma.transparencyRecord.findMany({
      where: {
        villageId: membership.villageId,
        stage: "PUBLISHED",
        visibility: { in: ["PUBLIC", "RESIDENT_ONLY"] },
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
      },
      select: { title: true },
      distinct: ["title"],
      take: 10,
      orderBy: [{ publishedAt: "desc" }],
    }),
  ]);

  const hasFilter = q !== "" || sort !== "date_desc" || selectedVisibilities.length > 0;

  return (
    <div className="space-y-6">
      <ResidentTransparencyToolbar
        keyword={q}
        sort={sort === "date_asc" ? "date_asc" : "date_desc"}
        selectedVisibilities={selectedVisibilities}
        suggestionTitles={suggestions.map((item) => item.title)}
      />

      {records.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={hasFilter ? "ไม่พบรายการที่ตรงกัน" : "ยังไม่มีข้อมูลความโปร่งใส"}
          description={
            hasFilter
              ? "ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง"
              : "รายการที่เผยแพร่ให้ลูกบ้านจะปรากฏที่นี่"
          }
        />
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <Link
              key={record.id}
              href={`/resident/transparency/${record.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-1">
                      <Badge
                        variant="outline"
                        className={
                          record.visibility === "PUBLIC"
                            ? "border-sky-200 bg-sky-50 text-sky-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }
                      >
                        {NEWS_VISIBILITY_LABELS[record.visibility]}
                      </Badge>
                  </div>
                  <p className="font-medium text-gray-900 line-clamp-1">{record.title}</p>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                    {record.category || "ไม่ระบุหมวดหมู่"}
                    {record.amount != null &&
                      ` • งบประมาณ ${record.amount.toLocaleString("th-TH")} บาท`}
                    {record.fiscalYear && ` • ปีงบประมาณ ${record.fiscalYear}`}
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


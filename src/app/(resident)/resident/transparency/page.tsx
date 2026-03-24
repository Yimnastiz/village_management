import Link from "next/link";
import { redirect } from "next/navigation";
import { NewsVisibility } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { NEWS_VISIBILITY_LABELS } from "@/lib/constants";

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

  const { q = "", sort = "date_desc", visibility = "ALL" } = await searchParams;

  const allowedVisibility: NewsVisibility[] =
    visibility === "PUBLIC"
      ? ["PUBLIC"]
      : visibility === "RESIDENT_ONLY"
        ? ["RESIDENT_ONLY"]
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

  const hasFilter = q !== "" || sort !== "date_desc" || visibility !== "ALL";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ความโปร่งใส</h1>

      {/* Search & filter */}
      <form method="GET" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs text-gray-500">ค้นหาหัวข้อ</label>
          <Input
            name="q"
            defaultValue={q}
            placeholder="พิมพ์หัวข้อความโปร่งใส..."
            list="transparency-suggestions"
            autoComplete="off"
          />
          <datalist id="transparency-suggestions">
            {suggestions.map((s) => (
              <option key={s.title} value={s.title} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">การมองเห็น</label>
          <select
            name="visibility"
            defaultValue={visibility}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">ทั้งหมด</option>
            <option value="PUBLIC">สาธารณะ</option>
            <option value="RESIDENT_ONLY">เฉพาะลูกบ้าน</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">เรียงตาม</label>
          <select
            name="sort"
            defaultValue={sort}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date_desc">วันที่ล่าสุด</option>
            <option value="date_asc">วันที่เก่าสุด</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            ค้นหา
          </button>
          {hasFilter && (
            <Link
              href="/resident/transparency"
              className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-600 hover:bg-gray-50"
            >
              ล้าง
            </Link>
          )}
        </div>
      </form>

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
                    <Badge variant="outline">{NEWS_VISIBILITY_LABELS[record.visibility]}</Badge>
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


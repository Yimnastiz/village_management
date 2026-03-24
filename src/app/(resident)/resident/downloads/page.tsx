import Link from "next/link";
import { Files } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { NEWS_VISIBILITY_LABELS } from "@/lib/constants";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

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
  const visibility = query.visibility === "PUBLIC" || query.visibility === "RESIDENT_ONLY"
    ? query.visibility
    : "ALL";

  const files = await prisma.downloadFile.findMany({
    where: {
      villageId: membership.villageId,
      stage: "PUBLISHED",
      visibility: visibility === "ALL" ? { in: ["PUBLIC", "RESIDENT_ONLY"] } : visibility,
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
      <h1 className="text-2xl font-bold text-gray-900">เอกสารดาวน์โหลด</h1>

      <form className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input
            name="q"
            label="ค้นหาชื่อเอกสาร"
            placeholder="พิมพ์ชื่อเอกสาร"
            defaultValue={keyword}
            list="resident-download-title-suggestions"
          />
          <datalist id="resident-download-title-suggestions">
            {suggestionTitles.map((title) => (
              <option key={title} value={title} />
            ))}
          </datalist>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">การมองเห็น</label>
            <select
              name="visibility"
              defaultValue={visibility}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="ALL">ทั้งหมด</option>
              <option value="RESIDENT_ONLY">เฉพาะเอกสารในหมู่บ้าน</option>
              <option value="PUBLIC">เฉพาะเอกสารสาธารณะ</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">เรียงตามวันที่เอกสาร</label>
            <select
              name="sort"
              defaultValue={sort}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="newest">ใหม่ไปเก่า</option>
              <option value="oldest">เก่าไปใหม่</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <Button type="submit" size="sm">ค้นหา</Button>
            <Link href="/resident/downloads">
              <Button type="button" variant="outline" size="sm">ล้างตัวกรอง</Button>
            </Link>
          </div>
        </div>
      </form>

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
                    <Badge variant="outline">{NEWS_VISIBILITY_LABELS[file.visibility]}</Badge>
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

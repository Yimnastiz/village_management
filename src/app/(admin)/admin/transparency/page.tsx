import Link from "next/link";
import { ShieldCheck, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { NEWS_VISIBILITY_LABELS, TRANSPARENCY_STAGE_LABELS } from "@/lib/constants";
import { SeedMockTransparencyButton } from "./seed-mock-button";

type PageProps = {
  searchParams?: Promise<{ q?: string; stage?: string; visibility?: string; sort?: string }>;
};

const stageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  DRAFT: "warning",
  PUBLISHED: "success",
  ARCHIVED: "default",
};

export default async function TransparencyPage({ searchParams }: PageProps) {
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

  const where: Prisma.TransparencyRecordWhereInput = { villageId: membership.villageId };
  if (activeStage !== "ALL") {
    where.stage = activeStage as Prisma.TransparencyRecordWhereInput["stage"];
  }
  if (activeVisibility !== "ALL") {
    where.visibility = activeVisibility as Prisma.TransparencyRecordWhereInput["visibility"];
  }
  if (keyword) {
    where.OR = [
      { title: { contains: keyword, mode: "insensitive" } },
      { description: { contains: keyword, mode: "insensitive" } },
      { category: { contains: keyword, mode: "insensitive" } },
      { fiscalYear: { contains: keyword, mode: "insensitive" } },
    ];
  }

  const orderBy =
    activeSort === "oldest"
      ? [{ publishedAt: "asc" as const }, { createdAt: "asc" as const }]
      : activeSort === "amount"
        ? [{ amount: "desc" as const }, { createdAt: "desc" as const }]
        : [{ publishedAt: "desc" as const }, { createdAt: "desc" as const }];

  let records = await prisma.transparencyRecord.findMany({
    where,
    orderBy,
    select: {
      id: true,
      title: true,
      category: true,
      amount: true,
      fiscalYear: true,
      stage: true,
      visibility: true,
      publishedAt: true,
      createdAt: true,
    },
  });

  if (records.length === 0) {
    await prisma.transparencyRecord.createMany({
      data: [
        {
          villageId: membership.villageId,
          title: "รายงานงบประมาณพัฒนาหมู่บ้าน (ตัวอย่าง PUBLIC)",
          description: "สรุปงบประมาณและผลการใช้จ่ายโครงการปรับปรุงถนนสาธารณะ",
          category: "งบประมาณ/โครงการ",
          amount: 120000,
          fiscalYear: "2569",
          stage: "PUBLISHED",
          visibility: "PUBLIC",
          publishedAt: new Date(),
        },
        {
          villageId: membership.villageId,
          title: "รายงานภายในคณะกรรมการ (ตัวอย่าง RESIDENT)",
          description: "รายละเอียดการประชุมและแผนจัดสรรงบประมาณภายในสำหรับลูกบ้าน",
          category: "รายงานประชุม",
          amount: 35000,
          fiscalYear: "2569",
          stage: "PUBLISHED",
          visibility: "RESIDENT_ONLY",
          publishedAt: new Date(),
        },
      ],
    });

    records = await prisma.transparencyRecord.findMany({
      where,
      orderBy,
      select: {
        id: true,
        title: true,
        category: true,
        amount: true,
        fiscalYear: true,
        stage: true,
        visibility: true,
        publishedAt: true,
        createdAt: true,
      },
    });
  }

  const suggestionTitles = Array.from(new Set(records.map((record) => record.title))).slice(0, 12);

  function buildTransparencyHref(next: { q?: string; stage?: string; visibility?: string; sort?: string }) {
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
    return queryString ? `/admin/transparency?${queryString}` : "/admin/transparency";
  }

  return (
    <div className="space-y-6">
      <AdminListToolbar
        title="ความโปร่งใส"
        description="จัดการรายการงบประมาณ โครงการ และข้อมูลการเปิดเผย"
        searchAction="/admin/transparency"
        keyword={keyword}
        searchPlaceholder="ค้นหาชื่อรายการ หมวดหมู่ หรือปีงบประมาณ"
        hiddenInputs={{ stage: activeStage === "ALL" ? "" : activeStage, visibility: activeVisibility === "ALL" ? "" : activeVisibility, sort: activeSort === "newest" ? "" : activeSort }}
        suggestionTitles={suggestionTitles}
        groups={[
          {
            label: "สถานะ",
            options: [
              { label: "ทั้งหมด", href: buildTransparencyHref({ q: keyword, stage: "ALL", visibility: activeVisibility, sort: activeSort }), active: activeStage === "ALL" },
              { label: "ร่าง", href: buildTransparencyHref({ q: keyword, stage: "DRAFT", visibility: activeVisibility, sort: activeSort }), active: activeStage === "DRAFT" },
              { label: "เผยแพร่", href: buildTransparencyHref({ q: keyword, stage: "PUBLISHED", visibility: activeVisibility, sort: activeSort }), active: activeStage === "PUBLISHED" },
              { label: "เก็บถาวร", href: buildTransparencyHref({ q: keyword, stage: "ARCHIVED", visibility: activeVisibility, sort: activeSort }), active: activeStage === "ARCHIVED" },
            ],
          },
          {
            label: "การมองเห็น",
            options: [
              { label: "ทั้งหมด", href: buildTransparencyHref({ q: keyword, stage: activeStage, visibility: "ALL", sort: activeSort }), active: activeVisibility === "ALL" },
              { label: "สาธารณะ", href: buildTransparencyHref({ q: keyword, stage: activeStage, visibility: "PUBLIC", sort: activeSort }), active: activeVisibility === "PUBLIC" },
              { label: "ลูกบ้าน", href: buildTransparencyHref({ q: keyword, stage: activeStage, visibility: "RESIDENT_ONLY", sort: activeSort }), active: activeVisibility === "RESIDENT_ONLY" },
            ],
          },
          {
            label: "เรียง",
            options: [
              { label: "ล่าสุดก่อน", href: buildTransparencyHref({ q: keyword, stage: activeStage, visibility: activeVisibility, sort: "newest" }), active: activeSort === "newest" },
              { label: "เก่าก่อน", href: buildTransparencyHref({ q: keyword, stage: activeStage, visibility: activeVisibility, sort: "oldest" }), active: activeSort === "oldest" },
              { label: "งบสูงก่อน", href: buildTransparencyHref({ q: keyword, stage: activeStage, visibility: activeVisibility, sort: "amount" }), active: activeSort === "amount" },
            ],
          },
        ]}
        actions={
          <>
            <SeedMockTransparencyButton />
            <Link href="/admin/transparency/new">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> เพิ่มรายการ
              </Button>
            </Link>
          </>
        }
      />

      {records.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <ShieldCheck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">ยังไม่มีข้อมูลความโปร่งใส</p>
          <p className="text-sm text-gray-400 mt-1">กดปุ่ม "สร้างข้อมูล mock" เพื่อสร้างตัวอย่าง PUBLIC/RESIDENT</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <Link
              key={record.id}
              href={`/admin/transparency/${record.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={stageVariant[record.stage] ?? "default"}>
                      {TRANSPARENCY_STAGE_LABELS[record.stage]}
                    </Badge>
                    <Badge variant="outline">{NEWS_VISIBILITY_LABELS[record.visibility]}</Badge>
                    {record.fiscalYear && <Badge variant="outline">ปี {record.fiscalYear}</Badge>}
                  </div>
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

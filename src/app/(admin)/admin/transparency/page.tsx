import Link from "next/link";
import { ShieldCheck, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { NEWS_VISIBILITY_LABELS, TRANSPARENCY_STAGE_LABELS } from "@/lib/constants";
import { SeedMockTransparencyButton } from "./seed-mock-button";

const stageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  DRAFT: "warning",
  PUBLISHED: "success",
  ARCHIVED: "default",
};

export default async function TransparencyPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  let records = await prisma.transparencyRecord.findMany({
    where: { villageId: membership.villageId },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
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
      where: { villageId: membership.villageId },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ความโปร่งใส</h1>
          <p className="text-sm text-gray-500 mt-1">จัดการรายการงบประมาณ โครงการ และข้อมูลการเปิดเผย</p>
        </div>
        <div className="flex items-center gap-2">
          <SeedMockTransparencyButton />
          <Link href="/admin/transparency/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> เพิ่มรายการ
            </Button>
          </Link>
        </div>
      </div>

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

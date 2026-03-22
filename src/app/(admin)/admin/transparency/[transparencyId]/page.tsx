import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { NEWS_VISIBILITY_LABELS, TRANSPARENCY_STAGE_LABELS } from "@/lib/constants";
import { DeleteTransparencyButton } from "./transparency-delete-button";

interface PageProps {
  params: Promise<{ transparencyId: string }>;
}

const stageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  DRAFT: "warning",
  PUBLISHED: "success",
  ARCHIVED: "default",
};

export default async function TransparencyDetailPage({ params }: PageProps) {
  const { transparencyId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const record = await prisma.transparencyRecord.findFirst({
    where: { id: transparencyId, villageId: membership.villageId },
  });
  if (!record) notFound();

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin/transparency" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> กลับรายการ
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/admin/transparency/${transparencyId}/edit`}>
            <Button size="sm" variant="outline">
              <Pencil className="h-4 w-4 mr-1" /> แก้ไข
            </Button>
          </Link>
          <DeleteTransparencyButton transparencyId={transparencyId} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="mb-4 flex items-center gap-2">
          <Badge variant={stageVariant[record.stage] ?? "default"}>
            {TRANSPARENCY_STAGE_LABELS[record.stage]}
          </Badge>
          <Badge variant="outline">{NEWS_VISIBILITY_LABELS[record.visibility]}</Badge>
          {record.fiscalYear && <Badge variant="outline">ปี {record.fiscalYear}</Badge>}
        </div>

        <h1 className="text-2xl font-bold text-gray-900">{record.title}</h1>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <span className="text-gray-500">หมวดหมู่:</span> {record.category || "-"}
          </div>
          <div>
            <span className="text-gray-500">จำนวนเงิน:</span>{" "}
            {record.amount != null ? record.amount.toLocaleString("th-TH") : "-"}
          </div>
          <div>
            <span className="text-gray-500">สร้างเมื่อ:</span> {record.createdAt.toLocaleDateString("th-TH")}
          </div>
          <div>
            <span className="text-gray-500">เผยแพร่เมื่อ:</span>{" "}
            {record.publishedAt ? record.publishedAt.toLocaleDateString("th-TH") : "-"}
          </div>
        </div>

        {record.description && (
          <div className="mt-6 border-t pt-6">
            <p className="whitespace-pre-wrap text-gray-700 leading-7">{record.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

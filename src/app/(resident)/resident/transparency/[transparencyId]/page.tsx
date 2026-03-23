import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { NEWS_VISIBILITY_LABELS } from "@/lib/constants";

interface PageProps {
  params: Promise<{ transparencyId: string }>;
}

export default async function ResidentTransparencyDetailPage({ params }: PageProps) {
  const { transparencyId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/auth/login");

  const record = await prisma.transparencyRecord.findFirst({
    where: {
      id: transparencyId,
      villageId: membership.villageId,
      stage: "PUBLISHED",
      visibility: { in: ["PUBLIC", "RESIDENT_ONLY"] },
    },
  });
  if (!record) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/resident/transparency"
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> กลับรายการความโปร่งใส
      </Link>

      <div className="rounded-xl border border-gray-200 bg-white p-8">
        <div className="mb-3">
          <Badge variant="outline">{NEWS_VISIBILITY_LABELS[record.visibility]}</Badge>
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
            <span className="text-gray-500">ปีงบประมาณ:</span> {record.fiscalYear || "-"}
          </div>
          <div>
            <span className="text-gray-500">เผยแพร่:</span>{" "}
            {(record.publishedAt ?? record.createdAt).toLocaleDateString("th-TH")}
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

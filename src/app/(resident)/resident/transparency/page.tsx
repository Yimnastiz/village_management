import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { NEWS_VISIBILITY_LABELS } from "@/lib/constants";

export default async function ResidentTransparencyPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const records = await prisma.transparencyRecord.findMany({
    where: {
      villageId: membership.villageId,
      stage: "PUBLISHED",
      visibility: { in: ["PUBLIC", "RESIDENT_ONLY"] },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ความโปร่งใส</h1>

      {records.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="ยังไม่มีข้อมูลความโปร่งใส"
          description="รายการที่เผยแพร่ให้ลูกบ้านจะปรากฏที่นี่"
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

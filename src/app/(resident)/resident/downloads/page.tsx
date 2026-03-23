import Link from "next/link";
import { Files } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { NEWS_VISIBILITY_LABELS } from "@/lib/constants";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

export default async function ResidentDownloadsPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/auth/login");

  const files = await prisma.downloadFile.findMany({
    where: {
      villageId: membership.villageId,
      stage: "PUBLISHED",
      visibility: { in: ["PUBLIC", "RESIDENT_ONLY"] },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">เอกสารดาวน์โหลด</h1>

      {files.length === 0 ? (
        <EmptyState icon={Files} title="ยังไม่มีเอกสาร" description="เอกสารที่เผยแพร่แล้วจะแสดงที่นี่" />
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

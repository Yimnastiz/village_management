import Link from "next/link";
import { Files } from "lucide-react";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/prisma";
import { normalizeVillageSlugParam, getSlugVariants } from "@/lib/village-slug";

interface PageProps {
  params: Promise<{ villageSlug: string }>;
}

export default async function DownloadsPage({ params }: PageProps) {
  const { villageSlug: rawVillageSlug } = await params;
  const villageSlug = normalizeVillageSlugParam(rawVillageSlug);

  const village = await prisma.village.findFirst({
    where: { slug: { in: getSlugVariants(villageSlug) } },
    select: { id: true, name: true, slug: true },
  });
  if (!village) notFound();

  const files = await prisma.downloadFile.findMany({
    where: {
      villageId: village.id,
      stage: "PUBLISHED",
      visibility: "PUBLIC",
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      publishedAt: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ศูนย์ดาวน์โหลดเอกสาร</h1>

      {files.length === 0 ? (
        <EmptyState
          icon={Files}
          title="ยังไม่มีเอกสารสาธารณะ"
          description={`เอกสารของหมู่บ้าน ${village.name} จะแสดงที่นี่`}
        />
      ) : (
        <div className="space-y-3">
          {files.map((file) => (
            <Link
              key={file.id}
              href={`/${village.slug}/downloads/${file.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
            >
              <p className="font-medium text-gray-900">{file.title}</p>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{file.description || "-"}</p>
              <p className="text-xs text-gray-400 mt-2">
                {file.category || "ทั่วไป"} • {(file.publishedAt ?? file.createdAt).toLocaleDateString("th-TH")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { formatDate, SupportNotice } from "../../public-content-ui";

export default async function SuperAdminNewsPreviewPage({
  params,
}: {
  params: Promise<{ villageId: string; newsId: string }>;
}) {
  const { villageId, newsId } = await params;
  const [village, news] = await Promise.all([
    prisma.village.findUnique({ where: { id: villageId }, select: { name: true, slug: true } }),
    prisma.news.findFirst({
      where: { id: newsId, villageId },
      select: {
        id: true,
        title: true,
        summary: true,
        content: true,
        imageUrls: true,
        stage: true,
        visibility: true,
        isPinned: true,
        publishedAt: true,
        updatedAt: true,
        author: { select: { name: true } },
      },
    }),
  ]);
  if (!news) notFound();
  const images = Array.isArray(news.imageUrls) ? news.imageUrls.map(String).filter(Boolean) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge variant="info">Preview</Badge>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">{news.title}</h2>
          <p className="text-sm text-slate-600">
            {news.stage} · {news.visibility} · {news.isPinned ? "Pinned" : "Normal"} · เผยแพร่ {formatDate(news.publishedAt)} · แก้ไข {formatDate(news.updatedAt)}
          </p>
        </div>
        <Link className="rounded-md border px-3 py-2 text-sm" href={`/superadmin/villages/${villageId}/news?edit=${news.id}`}>
          แก้ไขข่าวนี้
        </Link>
      </div>
      <SupportNotice villageName={village?.name ?? "-"} />
      <article className="rounded-lg border bg-white p-4">
        {images.length > 0 && (
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            {images.slice(0, 4).map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" className="h-56 w-full rounded object-cover" />
            ))}
          </div>
        )}
        {news.summary && <p className="mb-4 text-base text-slate-700">{news.summary}</p>}
        <div className="whitespace-pre-wrap text-sm leading-7 text-slate-800">{news.content}</div>
        <p className="mt-6 text-xs text-slate-500">ผู้เขียน/ผู้แก้ไขล่าสุด: {news.author?.name ?? "-"}</p>
      </article>
    </div>
  );
}

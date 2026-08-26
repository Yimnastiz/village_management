import Link from "next/link";
import { Globe2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ImageSource = { imageUrls?: unknown; coverUrl?: unknown };

function imageUrls(source: ImageSource) {
  return Array.isArray(source.imageUrls)
    ? source.imageUrls.map((value) => String(value)).filter((value) => value.length > 0)
    : [];
}

export function ResidentNewsThumbnail({ source, alt }: { source: ImageSource; alt: string }) {
  const images = imageUrls(source);
  const coverUrl = typeof source.coverUrl === "string" && images.includes(source.coverUrl) ? source.coverUrl : images[0];
  if (!coverUrl) return null;

  return <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100 sm:h-[72px] sm:w-24">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={coverUrl} alt={alt} className="h-full w-full object-cover" />
    {images.length > 1 ? <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">+{images.length - 1}</span> : null}
  </div>;
}

type RequestCardProps = {
  href: string;
  status: string;
  statusLabel: string;
  typeLabel: string;
  title: string;
  submittedAt: string;
  reviewedAt?: string;
  targetTitle?: string | null;
  source: ImageSource;
  note?: string | null;
};

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING: "warning", APPROVED: "success", REJECTED: "danger",
};

/** Shared, compact request card for the Pending and History workspaces. */
export function ResidentNewsRequestCard({ href, status, statusLabel, typeLabel, title, submittedAt, reviewedAt, targetTitle, source, note }: RequestCardProps) {
  const usefulTarget = targetTitle?.trim() && targetTitle.trim() !== title.trim() ? targetTitle.trim() : null;
  return <article className="rounded-xl border border-gray-200 bg-white transition hover:border-gray-300 hover:shadow-sm">
    <Link href={href} className="group flex gap-3 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-600 sm:gap-4 sm:p-5">
      <ResidentNewsThumbnail source={source} alt="" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5"><Badge variant={statusVariant[status] ?? "default"}>{statusLabel}</Badge><span className="text-sm text-gray-500">{typeLabel}</span></div>
          <time className="shrink-0 text-xs text-gray-400">ส่งเมื่อ {submittedAt}</time>
        </div>
        <h2 className="mt-2 break-words font-semibold leading-6 text-gray-900 transition-colors group-hover:text-green-700">{title}</h2>
        {usefulTarget ? <p className="mt-1 truncate text-sm text-gray-500">ข่าวต้นฉบับ: {usefulTarget}</p> : null}
        {reviewedAt ? <p className="mt-1.5 text-sm text-gray-600">พิจารณาเมื่อ {reviewedAt}</p> : null}
        {note ? <p className="mt-1 line-clamp-2 text-sm text-gray-600">{status === "REJECTED" ? "เหตุผล: " : "หมายเหตุ: "}{note}</p> : null}
      </div>
    </Link>
  </article>;
}

type PublishedCardProps = {
  href: string;
  title: string;
  summary?: string | null;
  publishedAt: string;
  visibility: "PUBLIC" | "RESIDENT_ONLY";
  source: ImageSource;
  hasPendingRequest: boolean;
};

/** Browse-focused counterpart that shares the request card spacing and thumbnail treatment. */
export function ResidentPublishedNewsCard({ href, title, summary, publishedAt, visibility, source, hasPendingRequest }: PublishedCardProps) {
  return <article className="rounded-xl border border-gray-200 bg-white transition hover:border-gray-300 hover:shadow-sm">
    <Link href={href} className="group flex gap-3 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-600 sm:gap-4 sm:p-5">
      <ResidentNewsThumbnail source={source} alt="" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-500">
            {visibility === "PUBLIC" ? <span className="inline-flex items-center gap-1"><Globe2 className="h-3.5 w-3.5" />สาธารณะ</span> : <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />เฉพาะลูกบ้าน</span>}
            {hasPendingRequest ? <span className="text-amber-700">มีคำขอรอพิจารณา</span> : null}
          </div>
          <time className="shrink-0 text-xs text-gray-400">เผยแพร่เมื่อ {publishedAt}</time>
        </div>
        <h2 className="mt-2 break-words font-semibold leading-6 text-gray-900 transition-colors group-hover:text-green-700">{title}</h2>
        {summary?.trim() ? <p className="mt-1 line-clamp-2 text-sm leading-5 text-gray-600">{summary}</p> : null}
      </div>
    </Link>
  </article>;
}

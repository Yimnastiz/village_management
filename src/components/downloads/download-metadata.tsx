import { Fragment, type ReactNode } from "react";
import { Globe2, Users } from "lucide-react";
import { DOWNLOAD_CATEGORY_LABELS } from "@/lib/downloads/constants";

interface DownloadMetadataProps {
  visibility: "PUBLIC" | "RESIDENT_ONLY";
  category: string | null;
  categoryLabel: string | null;
  attachmentCount: number;
  totalSize?: string;
  downloadCount?: number;
  date?: string;
}

interface DownloadVisibilityMetadataProps {
  visibility: "PUBLIC" | "RESIDENT_ONLY";
  category: string | null;
  categoryLabel: string | null;
}

export function DownloadVisibilityMetadata({ visibility, category, categoryLabel }: DownloadVisibilityMetadataProps) {
  const categoryText = category === "OTHER"
    ? categoryLabel || DOWNLOAD_CATEGORY_LABELS.OTHER
    : category
      ? DOWNLOAD_CATEGORY_LABELS[category] || category
      : "ทั่วไป";
  const VisibilityIcon = visibility === "PUBLIC" ? Globe2 : Users;
  const visibilityLabel = visibility === "PUBLIC" ? "สาธารณะ" : "เฉพาะลูกบ้าน";

  return <><span className="inline-flex items-center gap-1"><VisibilityIcon className="h-3.5 w-3.5 shrink-0" />{visibilityLabel}</span><span>{categoryText}</span></>;
}

export function DownloadMetadata({
  visibility,
  category,
  categoryLabel,
  attachmentCount,
  totalSize,
  downloadCount,
  date,
}: DownloadMetadataProps) {
  const categoryText = category === "OTHER"
    ? categoryLabel || DOWNLOAD_CATEGORY_LABELS.OTHER
    : category
      ? DOWNLOAD_CATEGORY_LABELS[category] || category
      : null;
  const VisibilityIcon = visibility === "PUBLIC" ? Globe2 : Users;
  const visibilityLabel = visibility === "PUBLIC" ? "สาธารณะ" : "เฉพาะลูกบ้าน";
  const items = [
    <span key="visibility" className="inline-flex items-center gap-1.5"><VisibilityIcon className="h-3.5 w-3.5 shrink-0" />{visibilityLabel}</span>,
    categoryText ? <span key="category">{categoryText}</span> : null,
    <span key="count">{attachmentCount} ไฟล์</span>,
    totalSize ? <span key="size">{totalSize}</span> : null,
    typeof downloadCount === "number" ? <span key="downloads">ดาวน์โหลด {downloadCount} ครั้ง</span> : null,
    date ? <span key="date">{date}</span> : null,
  ].filter(Boolean) as ReactNode[];

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-gray-500 sm:text-xs">
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 ? <span className="text-gray-400">·</span> : null}
          {item}
        </Fragment>
      ))}
    </div>
  );
}

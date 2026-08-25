import { Globe2, Users } from "lucide-react";
import { DOWNLOAD_CATEGORY_LABELS } from "@/lib/downloads/constants";

interface DownloadMetadataProps {
  visibility: "PUBLIC" | "RESIDENT_ONLY";
  category: string | null;
  categoryLabel: string | null;
  attachmentCount: number;
  date: string;
  totalSize?: string;
  downloadCount?: number;
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
  date,
  totalSize,
  downloadCount,
}: DownloadMetadataProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-500">
      <DownloadVisibilityMetadata visibility={visibility} category={category} categoryLabel={categoryLabel} />
      <span>{attachmentCount} ไฟล์</span>
      {totalSize ? <span>รวม {totalSize}</span> : null}
      {typeof downloadCount === "number" ? <span>ดาวน์โหลด {downloadCount} ครั้ง</span> : null}
      <span>{date}</span>
    </div>
  );
}

"use client";

import { PlaceImageManager } from "@/components/places/place-image-manager";
import type { PlaceImageInput, PlaceImageView } from "@/lib/place-image";
import { MAX_GALLERY_IMAGE_BYTES } from "@/lib/image-constraints";

export type GalleryImageDraft = PlaceImageView & {
  id: string;
  description: string;
  fileKey?: string;
  mimeType?: string;
  fileName?: string;
  sizeBytes?: number;
  source?: { type: "RESIDENT_SUBMISSION"; requesterName: string };
};

type Props = {
  value: GalleryImageDraft[];
  onChange: (items: GalleryImageDraft[]) => void;
  maxCount?: number;
  label?: string;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  autoSelectFirstCover?: boolean;
  allowCoverSelection?: boolean;
  allowReorder?: boolean;
};

/** Gallery adapter over the shared Places image manager. */
export function GalleryImageManager({ value, onChange, maxCount, label = "รูปภาพ", disabled, onBusyChange, autoSelectFirstCover, allowCoverSelection, allowReorder }: Props) {
  return <PlaceImageManager value={value} maxCount={maxCount} label={label} disabled={disabled} onBusyChange={onBusyChange} autoSelectFirstCover={autoSelectFirstCover} allowCoverSelection={allowCoverSelection} allowReorder={allowReorder} maxSizeBytes={MAX_GALLERY_IMAGE_BYTES} uploadEndpoint="/api/gallery/images" helpText="รองรับ JPG, PNG และ WebP สูงสุด 10 MB ต่อรูป ไม่เกิน 10 รูปต่อครั้ง" renderItemMetadata={(image) => {
    const source = (image as GalleryImageDraft).source;
    return source?.type === "RESIDENT_SUBMISSION" ? <p className="text-xs text-gray-500">คำขอจาก {source.requesterName}</p> : null;
  }} onChange={(next: PlaceImageInput[]) => onChange(next.map((image, index) => {
    const previous = image.id ? value.find((item) => item.id === image.id) : undefined;
    return { id: image.id ?? `gallery-${index}-${image.fileKey ?? image.url ?? "new"}`, url: image.url ?? previous?.url ?? "", fileKey: image.fileKey ?? previous?.fileKey, uploadToken: image.uploadToken, sortOrder: image.sortOrder, isCover: image.isCover, description: image.description ?? previous?.description ?? "", fileName: image.fileName ?? previous?.fileName, sizeBytes: image.sizeBytes ?? previous?.sizeBytes, source: previous?.source };
  }))} />;
}

"use client";

import { PlaceImageManager } from "@/components/places/place-image-manager";
import type { PlaceImageInput, PlaceImageView } from "@/lib/place-image";
import { MAX_GALLERY_IMAGE_BYTES } from "@/lib/image-constraints";

export type GalleryImageDraft = PlaceImageView & { id: string; description: string; fileKey?: string; mimeType?: string; fileName?: string; sizeBytes?: number };

type Props = {
  value: GalleryImageDraft[];
  onChange: (items: GalleryImageDraft[]) => void;
  maxCount?: number;
  label?: string;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  autoSelectFirstCover?: boolean;
};

/** Gallery's adapter over the shared sortable upload, cover and keyboard-DnD core used by Places. */
export function GalleryImageManager({ value, onChange, maxCount, label = "รูปภาพ", disabled, onBusyChange, autoSelectFirstCover }: Props) {
  return <PlaceImageManager
    value={value}
    maxCount={maxCount}
    label={label}
    disabled={disabled}
    onBusyChange={onBusyChange}
    autoSelectFirstCover={autoSelectFirstCover}
    maxSizeBytes={MAX_GALLERY_IMAGE_BYTES}
    uploadEndpoint="/api/gallery/images"
    helpText="รองรับ JPG, PNG และ WebP สูงสุด 10 MB ต่อรูป ไม่เกิน 10 รูปต่อครั้ง"
    onChange={(next: PlaceImageInput[]) => onChange(next.map((image, index) => {
      const previous = image.id ? value.find((item) => item.id === image.id) : undefined;
      return {
        id: image.id ?? `gallery-${index}-${image.fileKey ?? image.url ?? "new"}`,
        url: image.url ?? previous?.url ?? "",
        fileKey: image.fileKey ?? previous?.fileKey,
        uploadToken: image.uploadToken,
        sortOrder: image.sortOrder,
        isCover: image.isCover,
        description: image.description ?? previous?.description ?? "",
        fileName: image.fileName ?? previous?.fileName,
        sizeBytes: image.sizeBytes ?? previous?.sizeBytes,
      };
    }))}
  />;
}

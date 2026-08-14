"use client";

import { PlaceImageManager } from "@/components/places/place-image-manager";
import type { PlaceImageInput, PlaceImageView } from "@/lib/place-image";

export type GalleryImageDraft = PlaceImageView & { id: string; description: string; fileKey?: string; mimeType?: string };

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
      };
    }))}
  />;
}

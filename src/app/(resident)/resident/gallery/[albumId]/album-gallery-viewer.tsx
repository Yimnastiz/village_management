"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type AlbumGalleryViewerProps = {
  items: Array<{
    id: string;
    title: string | null;
    fileUrl: string;
  }>;
};

export function AlbumGalleryViewer({ items }: AlbumGalleryViewerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const canNavigate = items.length > 1;

  const selected = useMemo(() => items[selectedIndex] ?? null, [items, selectedIndex]);

  const prev = () => {
    if (!canNavigate) return;
    setSelectedIndex((current) => (current - 1 + items.length) % items.length);
  };

  const next = () => {
    if (!canNavigate) return;
    setSelectedIndex((current) => (current + 1) % items.length);
  };

  if (items.length === 0) {
    return <p className="text-sm text-gray-500">ยังไม่มีรูปภาพในอัลบั้มนี้</p>;
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-black/90">
        <button
          type="button"
          onClick={() => setIsLightboxOpen(true)}
          className="block w-full"
          aria-label="ดูรูปภาพขนาดใหญ่"
        >
          <div className="aspect-video">
            <img
              src={selected?.fileUrl || ""}
              alt={selected?.title || "ภาพในอัลบั้ม"}
              className="h-full w-full object-contain"
            />
          </div>
        </button>

        {canNavigate && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-gray-800 hover:bg-white"
              aria-label="รูปก่อนหน้า"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-gray-800 hover:bg-white"
              aria-label="รูปถัดไป"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item, index) => {
          const isActive = index === selectedIndex;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={`w-32 flex-shrink-0 overflow-hidden rounded-lg border ${isActive ? "border-green-500" : "border-gray-200"}`}
              aria-label={`เลือกรูปที่ ${index + 1}`}
            >
              <div className="aspect-video">
                <img src={item.fileUrl} alt={item.title || "thumbnail"} className="h-full w-full object-cover" />
              </div>
            </button>
          );
        })}
      </div>

      {selected?.title && <p className="text-sm text-gray-600">{selected.title}</p>}

      {isLightboxOpen && selected && (
        <div className="fixed inset-0 z-50 bg-black/90 p-4">
          <div className="mx-auto flex h-full max-w-6xl flex-col">
            <div className="flex items-center justify-between py-2">
              <p className="text-sm text-white/80">{selected.title || "ภาพกิจกรรม"}</p>
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="ปิด"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative flex-1 overflow-hidden rounded-xl border border-white/10 bg-black">
              <img src={selected.fileUrl} alt={selected.title || "ภาพกิจกรรม"} className="h-full w-full object-contain" />

              {canNavigate && (
                <>
                  <button
                    type="button"
                    onClick={prev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
                    aria-label="รูปก่อนหน้า"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
                    aria-label="รูปถัดไป"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

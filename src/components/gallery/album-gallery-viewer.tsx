"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Star, X } from "lucide-react";

type AlbumGalleryViewerProps = { items: Array<{ id: string; title: string | null; fileUrl: string; isCover?: boolean }> };

/** Shared read-only viewer for public, resident, and admin album detail pages. */
export function AlbumGalleryViewer({ items }: AlbumGalleryViewerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const touchStart = useRef<number | null>(null);
  const canNavigate = items.length > 1;
  const selected = useMemo(() => items[selectedIndex] ?? null, [items, selectedIndex]);
  const prev = () => canNavigate && setSelectedIndex((index) => (index - 1 + items.length) % items.length);
  const next = () => canNavigate && setSelectedIndex((index) => (index + 1) % items.length);

  useEffect(() => {
    if (!isLightboxOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsLightboxOpen(false);
      if (event.key === "ArrowLeft") prev();
      if (event.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!items.length) return <p className="text-sm text-gray-500">ยังไม่มีรูปภาพในอัลบั้มนี้</p>;
  const swipeEnd = (x: number) => {
    if (touchStart.current == null) return;
    const delta = x - touchStart.current; touchStart.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta > 0) prev(); else next();
  };
  const image = (className: string) => <img src={selected?.fileUrl || ""} alt={selected?.title || "ภาพในอัลบั้ม"} className={className} />;

  return <div className="space-y-4">
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-black/90" onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => swipeEnd(event.changedTouches[0]?.clientX ?? 0)}>
      <button type="button" onClick={() => setIsLightboxOpen(true)} className="block w-full" aria-label="ดูรูปภาพขนาดใหญ่"><div className="aspect-video">{image("h-full w-full object-contain")}</div></button>
      {selected?.isCover && <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-green-700 px-2 py-1 text-xs font-medium text-white"><Star className="h-3 w-3 fill-current" />หน้าปก</span>}
      {canNavigate && <><button type="button" onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-gray-800 hover:bg-white" aria-label="รูปก่อนหน้า"><ChevronLeft className="h-5 w-5" /></button><button type="button" onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-gray-800 hover:bg-white" aria-label="รูปถัดไป"><ChevronRight className="h-5 w-5" /></button></>}
    </div>
    <div className="flex gap-2 overflow-x-auto pb-1">{items.map((item, index) => <button key={item.id} type="button" onClick={() => setSelectedIndex(index)} className={`relative w-32 shrink-0 overflow-hidden rounded-lg border ${index === selectedIndex ? "border-green-500" : "border-gray-200"}`} aria-label={`เลือกรูปที่ ${index + 1}`}><div className="aspect-video"><img src={item.fileUrl} alt={item.title || "thumbnail"} className="h-full w-full object-cover" /></div>{item.isCover && <Star className="absolute right-1 top-1 h-3.5 w-3.5 fill-green-600 text-white drop-shadow" />}</button>)}</div>
    {selected?.title && <p className="text-sm text-gray-600">{selected.title}</p>}
    {isLightboxOpen && selected && <div className="fixed inset-0 z-50 bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="ดูรูปภาพขนาดใหญ่"><div className="mx-auto flex h-full max-w-6xl flex-col"><div className="flex items-center justify-between py-2"><p className="text-sm text-white/80">{selected.title || "ภาพกิจกรรม"}</p><button type="button" onClick={() => setIsLightboxOpen(false)} className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="ปิด"><X className="h-5 w-5" /></button></div><div className="relative flex-1 overflow-hidden rounded-xl border border-white/10 bg-black" onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => swipeEnd(event.changedTouches[0]?.clientX ?? 0)}>{image("h-full w-full object-contain")}{canNavigate && <><button type="button" onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/30" aria-label="รูปก่อนหน้า"><ChevronLeft className="h-5 w-5" /></button><button type="button" onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/30" aria-label="รูปถัดไป"><ChevronRight className="h-5 w-5" /></button></>}</div></div></div>}
  </div>;
}

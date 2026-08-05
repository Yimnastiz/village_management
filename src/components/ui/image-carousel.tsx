"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

type ImageCarouselProps = { images: string[]; altPrefix: string };

export function ImageCarousel({ images, altPrefix }: ImageCarouselProps) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);

  const previous = useCallback(() => { setIndex((value) => (value - 1 + images.length) % images.length); setZoom(1); }, [images.length]);
  const next = useCallback(() => { setIndex((value) => (value + 1) % images.length); setZoom(1); }, [images.length]);
  const close = useCallback(() => setOpen(false), []);
  const openAt = (nextIndex: number, opener: HTMLButtonElement) => { openerRef.current = opener; setIndex(nextIndex); setZoom(1); setOpen(true); };

  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const previousStyles = { overflow: document.body.style.overflow, position: document.body.style.position, top: document.body.style.top, width: document.body.style.width };
    document.body.style.overflow = "hidden"; document.body.style.position = "fixed"; document.body.style.top = `-${scrollY}px`; document.body.style.width = "100%";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft" && images.length > 1) previous();
      if (event.key === "ArrowRight" && images.length > 1) next();
      if (event.key === "Tab") {
        const dialog = closeRef.current?.closest('[role="dialog"]');
        const focusable = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? []);
        if (!focusable.length) return;
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown); closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousStyles.overflow; document.body.style.position = previousStyles.position; document.body.style.top = previousStyles.top; document.body.style.width = previousStyles.width;
      window.scrollTo(0, scrollY); openerRef.current?.focus();
    };
  }, [close, images.length, next, open, previous]);

  useEffect(() => {
    if (!open || images.length < 2) return;
    const preload = (source: string) => { const image = new Image(); image.src = source; };
    preload(images[(index - 1 + images.length) % images.length]); preload(images[(index + 1) % images.length]);
  }, [images, index, open]);

  if (!images.length) return null;
  const lightbox = open ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ดูรูปภาพข่าวแบบเต็มหน้าจอ"
      className="fixed inset-0 z-[100] grid h-[100dvh] w-screen grid-rows-[auto_minmax(0,1fr)_auto] bg-black/95 text-white"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingRight: "env(safe-area-inset-right)", paddingBottom: "env(safe-area-inset-bottom)", paddingLeft: "env(safe-area-inset-left)" }}
      onPointerDown={(event) => { draggedRef.current = false; if (event.target === event.currentTarget) close(); }}
    >
      <div className="flex min-h-14 items-center justify-between border-b border-white/10 px-3 sm:px-5">
        <span aria-live="polite" className="text-sm font-medium">{index + 1} / {images.length}</span>
        <button ref={closeRef} type="button" onClick={close} aria-label="ปิดตัวดูรูปภาพ" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"><X className="h-5 w-5" /></button>
      </div>
      <div
        className="relative flex min-h-0 touch-none items-center justify-center overflow-auto p-2 sm:p-4"
        onPointerUp={(event) => { if (event.target === event.currentTarget && !draggedRef.current && zoom === 1) close(); }}
        onTouchStart={(event) => { const touch = event.touches[0]; touchStartRef.current = { x: touch.clientX, y: touch.clientY }; draggedRef.current = false; }}
        onTouchMove={(event) => { const start = touchStartRef.current; const touch = event.touches[0]; if (start && (Math.abs(touch.clientX - start.x) > 8 || Math.abs(touch.clientY - start.y) > 8)) draggedRef.current = true; }}
        onTouchEnd={(event) => { const start = touchStartRef.current; touchStartRef.current = null; if (!start || zoom > 1 || images.length < 2) return; const touch = event.changedTouches[0]; const dx = touch.clientX - start.x; const dy = touch.clientY - start.y; if (Math.abs(dx) >= 56 && Math.abs(dx) > Math.abs(dy) * 1.25) { if (dx > 0) previous(); else next(); } }}
        onDoubleClick={() => setZoom((value) => value === 1 ? 2 : 1)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[index]} alt={`${altPrefix} รูปที่ ${index + 1}`} draggable={false} className="max-h-full max-w-full select-none object-contain transition-transform duration-150 motion-reduce:transition-none" style={{ transform: `scale(${zoom})`, transformOrigin: "center" }} />
      </div>
      <div className="flex min-h-16 items-center justify-center gap-2 border-t border-white/10 px-3 py-2">
        {images.length > 1 ? <Button type="button" variant="outline" onClick={previous} aria-label="ดูรูปก่อนหน้า" className="h-11 min-w-11 border-white/30 bg-white/10 px-3 text-white hover:bg-white/20"><ChevronLeft className="h-5 w-5" /></Button> : null}
        <button type="button" onClick={() => setZoom((value) => Math.max(1, value - 0.5))} disabled={zoom <= 1} aria-label="ย่อรูป" className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 disabled:opacity-40"><Minus className="h-5 w-5" /></button>
        <span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((value) => Math.min(3, value + 0.5))} disabled={zoom >= 3} aria-label="ขยายรูป" className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 disabled:opacity-40"><Plus className="h-5 w-5" /></button>
        {images.length > 1 ? <Button type="button" variant="outline" onClick={next} aria-label="ดูรูปถัดไป" className="h-11 min-w-11 border-white/30 bg-white/10 px-3 text-white hover:bg-white/20"><ChevronRight className="h-5 w-5" /></Button> : null}
      </div>
    </div>
  ) : null;

  return <div className="min-w-0 space-y-3">
    <button type="button" onClick={(event) => openAt(index, event.currentTarget)} aria-label={`เปิดดูรูปที่ ${index + 1} แบบขยาย`} className="block w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-600">
      {/* eslint-disable-next-line @next/next/no-img-element */}<img src={images[index]} alt={`${altPrefix} รูปที่ ${index + 1}`} className="max-h-[min(60dvh,520px)] w-full object-contain" />
    </button>
    {images.length > 1 ? <div className="flex max-w-full gap-2 overflow-x-auto pb-1">{images.map((url, itemIndex) => <button key={`${url}-${itemIndex}`} type="button" onClick={(event) => openAt(itemIndex, event.currentTarget)} aria-label={`เปิดดูรูปที่ ${itemIndex + 1} แบบขยาย`} className={`h-14 w-20 shrink-0 overflow-hidden rounded-md border focus:outline-none focus:ring-2 focus:ring-green-600 ${itemIndex === index ? "border-green-500" : "border-gray-200"}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={url} alt="" className="h-full w-full object-cover" /></button>)}</div> : null}
    {lightbox && typeof document !== "undefined" ? createPortal(lightbox, document.body) : null}
  </div>;
}

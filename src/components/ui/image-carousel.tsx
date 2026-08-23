"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

type ImageCarouselProps = { images: string[]; altPrefix: string; coverIndex?: number; initialIndex?: number; compact?: boolean; thumbnailBehavior?: "open" | "select" };
type ImageLightboxProps = {
  images: string[];
  altPrefix: string;
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  coverIndex?: number;
  returnFocusElement?: HTMLElement | null;
};

/** Controlled portal lightbox shared by gallery views and thumbnail-driven workflows. */
export function ImageLightbox({ images, altPrefix, index, onIndexChange, onClose, coverIndex, returnFocusElement }: ImageLightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const safeIndex = Math.max(0, Math.min(index, Math.max(0, images.length - 1)));
  const hasCover = coverIndex != null && coverIndex >= 0 && coverIndex < images.length;
  const resetTransform = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);
  const selectIndex = useCallback((nextIndex: number) => { resetTransform(); onIndexChange(nextIndex); }, [onIndexChange, resetTransform]);
  const previous = useCallback(() => { if (images.length < 2) return; selectIndex((safeIndex - 1 + images.length) % images.length); }, [images.length, safeIndex, selectIndex]);
  const next = useCallback(() => { if (images.length < 2) return; selectIndex((safeIndex + 1) % images.length); }, [images.length, safeIndex, selectIndex]);
  const close = useCallback(() => { resetTransform(); onClose(); }, [onClose, resetTransform]);
  const actionsRef = useRef({ close, previous, next });
  const returnFocusRef = useRef<HTMLElement | null>(returnFocusElement ?? null);
  useEffect(() => { actionsRef.current = { close, previous, next }; }, [close, next, previous]);
  useEffect(() => { returnFocusRef.current = returnFocusElement ?? null; }, [returnFocusElement]);

  useEffect(() => {
    const scrollY = window.scrollY;
    const previousStyles = { overflow: document.body.style.overflow, position: document.body.style.position, top: document.body.style.top, width: document.body.style.width };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") actionsRef.current.close();
      if (event.key === "ArrowLeft") actionsRef.current.previous();
      if (event.key === "ArrowRight") actionsRef.current.next();
      if (event.key === "Tab") {
        const dialog = closeRef.current?.closest('[role="dialog"]');
        const focusable = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? []);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousStyles.overflow;
      document.body.style.position = previousStyles.position;
      document.body.style.top = previousStyles.top;
      document.body.style.width = previousStyles.width;
      window.scrollTo(0, scrollY);
      returnFocusRef.current?.focus();
    };
  }, []);
  useEffect(() => {
    if (images.length < 2) return;
    const preload = (source: string) => { const image = new Image(); image.src = source; };
    preload(images[(safeIndex - 1 + images.length) % images.length]);
    preload(images[(safeIndex + 1) % images.length]);
  }, [images, safeIndex]);

  if (!images.length || typeof document === "undefined") return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="ดูรูปภาพแบบเต็มหน้าจอ" className="fixed inset-0 z-[100] grid h-[100dvh] w-screen grid-rows-[auto_minmax(0,1fr)_auto] bg-black/95 text-white" style={{ paddingTop: "env(safe-area-inset-top)", paddingRight: "env(safe-area-inset-right)", paddingBottom: "env(safe-area-inset-bottom)", paddingLeft: "env(safe-area-inset-left)" }} onPointerDown={(event) => { draggedRef.current = false; if (event.target === event.currentTarget) close(); }}>
      <div className="flex min-h-14 items-center justify-between border-b border-white/10 px-3 sm:px-5"><span aria-live="polite" className="text-sm font-medium">{safeIndex + 1} / {images.length}</span><button ref={closeRef} type="button" onClick={close} aria-label="ปิดตัวดูรูปภาพ" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"><X className="h-5 w-5" /></button></div>
      <div className={`relative flex min-h-0 touch-none items-center justify-center overflow-hidden p-2 sm:p-4 ${zoom > 1 ? "cursor-grab active:cursor-grabbing" : ""}`} onPointerDown={(event) => { draggedRef.current = false; if (zoom > 1) { event.currentTarget.setPointerCapture(event.pointerId); panStartRef.current = { x: event.clientX, y: event.clientY, originX: pan.x, originY: pan.y }; } }} onPointerMove={(event) => { const start = panStartRef.current; if (!start || zoom <= 1) return; const bounds = event.currentTarget.getBoundingClientRect(); const maxX = bounds.width * (zoom - 1) / 2; const maxY = bounds.height * (zoom - 1) / 2; const x = Math.max(-maxX, Math.min(maxX, start.originX + event.clientX - start.x)); const y = Math.max(-maxY, Math.min(maxY, start.originY + event.clientY - start.y)); if (Math.abs(event.clientX - start.x) > 4 || Math.abs(event.clientY - start.y) > 4) draggedRef.current = true; setPan({ x, y }); }} onPointerCancel={() => { panStartRef.current = null; }} onPointerUp={(event) => { panStartRef.current = null; if (event.target === event.currentTarget && !draggedRef.current && zoom === 1) close(); }} onTouchStart={(event) => { const touch = event.touches[0]; touchStartRef.current = { x: touch.clientX, y: touch.clientY }; draggedRef.current = false; }} onTouchMove={(event) => { const start = touchStartRef.current; const touch = event.touches[0]; if (start && (Math.abs(touch.clientX - start.x) > 8 || Math.abs(touch.clientY - start.y) > 8)) draggedRef.current = true; }} onTouchEnd={(event) => { const start = touchStartRef.current; touchStartRef.current = null; if (!start || zoom > 1 || images.length < 2) return; const touch = event.changedTouches[0]; const dx = touch.clientX - start.x; const dy = touch.clientY - start.y; if (Math.abs(dx) >= 56 && Math.abs(dx) > Math.abs(dy) * 1.25) { if (dx > 0) previous(); else next(); } }} onDoubleClick={() => { setZoom((value) => value === 1 ? 2 : 1); setPan({ x: 0, y: 0 }); }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}<img src={images[safeIndex]} alt={`${altPrefix} รูปที่ ${safeIndex + 1}${hasCover && safeIndex === coverIndex ? " หน้าปก" : ""}`} draggable={false} className="max-h-full max-w-full select-none object-contain transition-transform duration-150 motion-reduce:transition-none" style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`, transformOrigin: "center" }} />
        {hasCover && safeIndex === coverIndex ? <span className="absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-xs font-medium text-white">หน้าปก</span> : null}
      </div>
      <div className="flex min-h-16 items-center justify-center gap-2 border-t border-white/10 px-3 py-2">{images.length > 1 ? <Button type="button" variant="outline" onClick={previous} aria-label="ดูรูปก่อนหน้า" className="h-11 min-w-11 border-white/30 bg-white/10 px-3 text-white hover:bg-white/20"><ChevronLeft className="h-5 w-5" /></Button> : null}<button type="button" onClick={() => setZoom((value) => Math.max(1, value - 0.5))} disabled={zoom <= 1} aria-label="ย่อรูป" className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 disabled:opacity-40"><Minus className="h-5 w-5" /></button><span className="w-10 text-center text-xs tabular-nums sm:w-12">{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((value) => Math.min(3, value + 0.5))} disabled={zoom >= 3} aria-label="ขยายรูป" className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 disabled:opacity-40"><Plus className="h-5 w-5" /></button>{images.length > 1 ? <Button type="button" variant="outline" onClick={next} aria-label="ดูรูปถัดไป" className="h-11 min-w-11 border-white/30 bg-white/10 px-3 text-white hover:bg-white/20"><ChevronRight className="h-5 w-5" /></Button> : null}</div>
    </div>,
    document.body,
  );
}

export function ImageCarousel({ images, altPrefix, coverIndex, initialIndex = 0, compact = false, thumbnailBehavior = "open" }: ImageCarouselProps) {
  const [index, setIndex] = useState(() => Math.max(0, Math.min(initialIndex, Math.max(0, images.length - 1))));
  const [open, setOpen] = useState(false);
  const [returnFocusElement, setReturnFocusElement] = useState<HTMLButtonElement | null>(null);
  const galleryTouchRef = useRef<number | null>(null);
  const safeIndex = Math.max(0, Math.min(index, Math.max(0, images.length - 1)));
  const hasCover = coverIndex != null && coverIndex >= 0 && coverIndex < images.length;
  const previous = () => setIndex((value) => (value - 1 + images.length) % images.length);
  const next = () => setIndex((value) => (value + 1) % images.length);
  const openAt = (nextIndex: number, opener: HTMLButtonElement) => { setReturnFocusElement(opener); setIndex(nextIndex); setOpen(true); };

  if (!images.length) return null;
  const viewer = open ? <ImageLightbox images={images} altPrefix={altPrefix} coverIndex={coverIndex} index={safeIndex} onIndexChange={setIndex} onClose={() => setOpen(false)} returnFocusElement={returnFocusElement} /> : null;
  if (compact) return <button type="button" onClick={(event) => openAt(safeIndex, event.currentTarget)} aria-label={`เปิดดูรูปที่ ${safeIndex + 1} แบบขยาย`} className="block w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-600"><img src={images[safeIndex]} alt={`${altPrefix} รูปที่ ${safeIndex + 1}`} className="aspect-[4/3] w-full object-cover" />{viewer}</button>;

  return <div className="min-w-0 space-y-3"><div className="relative" onTouchStart={(event) => { galleryTouchRef.current = event.touches[0].clientX; }} onTouchEnd={(event) => { const start = galleryTouchRef.current; galleryTouchRef.current = null; if (start === null || images.length < 2) return; const delta = event.changedTouches[0].clientX - start; if (Math.abs(delta) >= 48) { if (delta > 0) previous(); else next(); } }}><button type="button" onClick={(event) => openAt(safeIndex, event.currentTarget)} aria-label={`เปิดดูรูปที่ ${safeIndex + 1}${hasCover && safeIndex === coverIndex ? " หน้าปก" : ""} แบบขยาย`} className="block w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-600">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={images[safeIndex]} alt={`${altPrefix} รูปที่ ${safeIndex + 1}`} className="max-h-[min(60dvh,520px)] w-full object-contain" /></button>{hasCover && safeIndex === coverIndex ? <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-2 py-1 text-xs font-medium text-white">หน้าปก</span> : null}{images.length > 1 ? <><Button type="button" variant="outline" onClick={previous} aria-label="ดูรูปก่อนหน้า" className="absolute left-2 top-1/2 h-11 w-11 -translate-y-1/2 bg-white/90 p-0"><ChevronLeft className="h-5 w-5" /></Button><Button type="button" variant="outline" onClick={next} aria-label="ดูรูปถัดไป" className="absolute right-2 top-1/2 h-11 w-11 -translate-y-1/2 bg-white/90 p-0"><ChevronRight className="h-5 w-5" /></Button><span aria-live="polite" className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-2 py-1 text-xs text-white">{safeIndex + 1} / {images.length}</span></> : null}</div>{images.length > 1 ? <div className="flex max-w-full gap-2 overflow-x-auto px-1 py-1">{images.map((url, itemIndex) => <button key={`${url}-${itemIndex}`} type="button" onClick={(event) => thumbnailBehavior === "select" ? setIndex(itemIndex) : openAt(itemIndex, event.currentTarget)} aria-label={thumbnailBehavior === "select" ? `เลือกรูปที่ ${itemIndex + 1}` : `เปิดดูรูปที่ ${itemIndex + 1} แบบขยาย`} className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-md border focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${itemIndex === safeIndex ? "border-green-500 ring-1 ring-green-500" : "border-gray-200"}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={url} alt="" className="h-full w-full object-cover" />{hasCover && itemIndex === coverIndex ? <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">หน้าปก</span> : null}</button>)}</div> : null}{viewer}</div>;
}

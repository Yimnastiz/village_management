"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ImageLightbox } from "@/components/ui/image-carousel";

type GalleryRequestImage = {
  id: string;
  url: string;
  title: string | null;
  status: string;
  reviewNote: string | null;
};

type Props = {
  albumTitle: string;
  images: GalleryRequestImage[];
  highlightedId?: string;
};

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" };
const statusLabel: Record<string, string> = { PENDING: "รอพิจารณา", APPROVED: "อนุมัติแล้ว", REJECTED: "ไม่อนุมัติ" };

/** One controlled lightbox for all submitted images in a single request batch. */
export function GalleryRequestImageViewer({ albumTitle, images, highlightedId }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [returnFocusElement, setReturnFocusElement] = useState<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!highlightedId) return;
    const card = document.getElementById(highlightedId);
    const frame = window.requestAnimationFrame(() => card?.scrollIntoView({ block: "center" }));
    return () => window.cancelAnimationFrame(frame);
  }, [highlightedId]);

  const openAt = (index: number, opener: HTMLButtonElement) => { setReturnFocusElement(opener); setSelectedIndex(index); setOpen(true); };
  const selected = Math.max(0, Math.min(selectedIndex, Math.max(0, images.length - 1)));

  return <>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {images.map((image, index) => <article id={image.id} key={image.id} className={`scroll-mt-24 overflow-hidden rounded-xl border bg-white ${highlightedId === image.id ? "border-green-500 ring-2 ring-green-100" : "border-gray-200"}`}>
        <button type="button" onClick={(event) => openAt(index, event.currentTarget)} aria-label={`เปิดดูรูปที่ ${index + 1} แบบขยาย`} className="block w-full overflow-hidden bg-gray-50 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-600">
          {/* eslint-disable-next-line @next/next/no-img-element */}<img src={image.url} alt={image.title || `รูปที่ ${index + 1}`} className="aspect-[4/3] w-full object-cover" />
        </button>
        <div className="space-y-3 p-4"><div className="flex items-center justify-between gap-2"><p className="font-medium text-gray-900">รูปที่ {index + 1}</p><Badge variant={statusVariant[image.status] ?? "default"}>{statusLabel[image.status]}</Badge></div>{image.title ? <p className="text-sm text-gray-600">{image.title}</p> : null}{image.status === "REJECTED" ? <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900"><p className="font-medium">เหตุผลที่ไม่อนุมัติ</p><p className="mt-1 whitespace-pre-wrap">{image.reviewNote || "-"}</p></div> : null}{image.status === "APPROVED" && image.reviewNote ? <div className="rounded-lg bg-green-50 p-3 text-sm text-green-900"><p className="font-medium">หมายเหตุจากผู้พิจารณา</p><p className="mt-1 whitespace-pre-wrap">{image.reviewNote}</p></div> : null}</div>
      </article>)}
    </div>
    {open ? <ImageLightbox images={images.map((image) => image.url)} altPrefix={`คำขอเพิ่มรูป ${albumTitle}`} index={selected} onIndexChange={setSelectedIndex} onClose={() => setOpen(false)} returnFocusElement={returnFocusElement} /> : null}
  </>;
}

"use client";

import Link from "next/link";
import { Megaphone, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { SystemBroadcastTickerItem } from "@/lib/system-broadcast-ticker.server";

export function SystemBroadcastTicker({ items }: { items: SystemBroadcastTickerItem[] }) {
  const item = items[0];
  const viewportRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [overflowDistance, setOverflowDistance] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(mediaQuery.matches);
    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);
    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    const measure = () => {
      const distance = Math.max(0, track.scrollWidth - viewport.clientWidth);
      setOverflowDistance(distance);
      setIsOverflowing(distance > 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(track);
    return () => observer.disconnect();
  }, [item?.id, item?.title, item?.body]);

  if (!item) return null;

  const announcementText = item.body ? `${item.title} — ${item.body}` : item.title;
  const indicator = items.length > 1 ? `+${items.length - 1} ประกาศ` : null;

  return (
    <Link
      href={item.href}
      aria-label={`อ่านประกาศ: ${item.title}`}
      title="ประกาศโดยผู้ใหญ่บ้าน"
      className="group block rounded-xl border border-amber-200 bg-white shadow-sm transition hover:border-amber-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
    >
      <div className="flex min-h-12 items-center gap-3 px-3 py-2.5 sm:px-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700" aria-hidden="true">
          <Megaphone className="size-4" />
        </span>
        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">ประกาศ</span>
        <span ref={viewportRef} className="min-w-0 flex-1 overflow-hidden text-sm text-slate-700">
          <span
            ref={trackRef}
            className={`inline-block whitespace-nowrap align-bottom ${isOverflowing && !reducedMotion ? "broadcast-ticker-track" : "max-w-full truncate"}`}
            style={{ "--broadcast-ticker-shift": `${overflowDistance}px` } as CSSProperties}
          >
            {announcementText}
          </span>
        </span>
        {indicator ? <span className="shrink-0 text-xs text-slate-500">{indicator}</span> : null}
        <ChevronRight className="size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </div>
      <style jsx>{`
        .broadcast-ticker-track {
          animation: broadcast-ticker-scroll 24s ease-in-out infinite alternate;
          padding-right: 3rem;
        }
        .group:hover .broadcast-ticker-track,
        .group:focus-visible .broadcast-ticker-track {
          animation-play-state: paused;
        }
        @keyframes broadcast-ticker-scroll {
          0%, 12% { transform: translateX(0); }
          88%, 100% { transform: translateX(calc(-1 * var(--broadcast-ticker-shift))); }
        }
        @media (prefers-reduced-motion: reduce) {
          .broadcast-ticker-track { animation: none; }
        }
      `}</style>
    </Link>
  );
}

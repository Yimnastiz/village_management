"use client";
import { useEffect, useRef, useState } from "react";

export function useAutoHideTopBar(locked = false) {
  const [hidden, setHidden] = useState(false);
  const lastScrollRef = useRef(0);
  const tickingRef = useRef(false);
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(max-width: 767px)");
    const setVisibleOffset = (value: "0px" | "4rem") => {
      root.style.setProperty("--app-topbar-height", "4rem");
      root.style.setProperty("--app-topbar-visible-offset", value);
      root.style.setProperty("--app-sticky-top", value);
      root.style.setProperty("--resident-sticky-top", value);
    };
    const show = () => { setHidden(false); setVisibleOffset("4rem"); };
    const update = () => {
      tickingRef.current = false;
      const current = Math.max(0, window.scrollY); const delta = current - lastScrollRef.current;
      const typing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
      if (!media.matches || locked || typing || current <= 16) show();
      else if (delta > 12) { setHidden(true); setVisibleOffset("0px"); }
      else if (delta < -8) show();
      lastScrollRef.current = current;
    };
    const onScroll = () => { if (!tickingRef.current) { tickingRef.current = true; requestAnimationFrame(update); } };
    const onMedia = () => { if (!media.matches) show(); };
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) show();
    };
    lastScrollRef.current = window.scrollY; setVisibleOffset("4rem");
    root.style.setProperty("--app-topbar-motion", window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "0ms" : "180ms");
    window.addEventListener("scroll", onScroll, { passive: true }); window.addEventListener("focusin", onFocusIn); media.addEventListener("change", onMedia);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("focusin", onFocusIn); media.removeEventListener("change", onMedia); root.style.removeProperty("--app-topbar-height"); root.style.removeProperty("--app-topbar-visible-offset"); root.style.removeProperty("--app-sticky-top"); root.style.removeProperty("--resident-sticky-top"); root.style.removeProperty("--app-topbar-motion"); };
  }, [locked]);
  return hidden;
}

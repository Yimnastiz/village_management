"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

type FormInfoPopoverProps = {
  label: string;
  children: React.ReactNode;
};

/** Compact, anchored workflow help for forms without allocating a full helper row. */
export function FormInfoPopover({ label, children }: FormInfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div ref={rootRef} className="relative inline-flex">
    <button type="button" aria-label={label} title={label} aria-expanded={open} aria-controls={popoverId} onClick={() => setOpen((value) => !value)} className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1">
      <Info className="h-4 w-4" aria-hidden="true" />
    </button>
    {open ? <div id={popoverId} role="dialog" aria-label={label} className="absolute right-0 top-full z-20 mt-2 w-[min(20rem,calc(100vw-3rem))] rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-600 shadow-lg">
      <p className="font-medium text-slate-800">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div> : null}
  </div>;
}

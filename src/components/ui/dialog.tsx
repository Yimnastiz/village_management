"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  className?: string;
};

/** Shared accessible modal shell for operational forms. */
export function Dialog({ open, title, description, children, footer, onClose, className }: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); returnFocusRef.current?.focus(); };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end bg-slate-950/50 sm:items-center sm:justify-center sm:p-4" onMouseDown={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className={cn("flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl sm:rounded-2xl", className)} onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 px-4 py-4 sm:px-5">
          <div><h2 id={titleId} className="text-lg font-semibold text-gray-900">{title}</h2>{description ? <p id={descriptionId} className="mt-1 text-sm leading-5 text-gray-500">{description}</p> : null}</div>
          <button ref={closeRef} type="button" onClick={onClose} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500" aria-label="ปิดหน้าต่าง"><X className="h-5 w-5" aria-hidden="true" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer ? <footer className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 sm:px-5">{footer}</footer> : null}
      </div>
    </div>, document.body,
  );
}

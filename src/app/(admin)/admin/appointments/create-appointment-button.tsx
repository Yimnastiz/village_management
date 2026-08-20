"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateAppointmentForm } from "./create-appointment-form";

const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function CreateAppointmentButton() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    if (submitting) return;
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, submitting]);

  const modal = open && typeof document !== "undefined" ? createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="create-appointment-title" className="relative flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4"><h2 id="create-appointment-title" className="text-lg font-semibold">สร้างนัดหมายให้ลูกบ้าน</h2><button ref={closeButtonRef} type="button" aria-label="ปิด" disabled={submitting} onClick={close} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50"><X className="h-5 w-5" /></button></div>
        <div className="overflow-y-auto p-5"><CreateAppointmentForm onClose={close} onPendingChange={setSubmitting} /></div>
      </div>
    </div>,
    document.body,
  ) : null;

  return <><Button ref={triggerRef} size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> สร้างนัดหมาย</Button>{modal}</>;
}

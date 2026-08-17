"use client";

import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  pending?: boolean;
  confirmDisabled?: boolean;
  children?: React.ReactNode;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  tone = "default",
  pending = false,
  confirmDisabled = false,
  children,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  const dialog = (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{description}</p> : null}
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            isLoading={pending}
            disabled={pending || confirmDisabled}
            className={cn("min-h-11", tone === "danger" ? "bg-rose-600 hover:bg-rose-700 focus:ring-rose-500" : "")}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(dialog, document.body);
}

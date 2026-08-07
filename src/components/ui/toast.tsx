"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info" | "warning";

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
};

type ToastContextValue = {
  pushToast: (toast: Omit<ToastItem, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneClasses: Record<ToastTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

const toneIcons = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
  warning: AlertCircle,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((currentValue) => currentValue.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextToast = { ...toast, id };
    setToasts((currentValue) => [...currentValue, nextToast]);
    window.setTimeout(() => removeToast(id), 3600);
  }, [removeToast]);

  const value = useMemo(() => ({
    pushToast,
    success: (title: string, description?: string) => pushToast({ tone: "success", title, description }),
    error: (title: string, description?: string) => pushToast({ tone: "error", title, description }),
    info: (title: string, description?: string) => pushToast({ tone: "info", title, description }),
    warning: (title: string, description?: string) => pushToast({ tone: "warning", title, description }),
  }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 top-4 z-[150] flex max-w-none flex-col gap-3 sm:left-auto sm:right-4 sm:w-full sm:max-w-sm" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => {
          const Icon = toneIcons[toast.tone];
          return (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto rounded-xl border p-4 shadow-lg backdrop-blur motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2",
                toneClasses[toast.tone]
              )}
            >
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{toast.title}</p>
                  {toast.description ? <p className="mt-1 text-xs opacity-80">{toast.description}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="cursor-pointer rounded-md p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current"
                  aria-label="ปิดข้อความ"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}

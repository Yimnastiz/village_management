"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function NotFoundBackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 sm:w-auto"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      กลับหน้าก่อนหน้า
    </button>
  );
}

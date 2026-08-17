"use client";

import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { clearLoginOtpState } from "@/lib/auth-client";

export function DuplicateAccountActions({ unavailable = false }: { unavailable?: boolean }) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { error: showError } = useToast();

  const finishNotice = async (destination: "/auth/login" | "/auth/register") => {
    if (isSigningOut) return;

    setIsSigningOut(true);
    try {
      const response = await fetch("/api/auth/duplicate-notice/finish", { method: "POST" });
      if (!response.ok) throw new Error("Unable to finish duplicate-account notice.");
      clearLoginOtpState();
      window.location.replace(destination);
    } catch {
      showError("ไม่สามารถออกจากระบบได้", "กรุณาลองอีกครั้ง");
      setIsSigningOut(false);
    }
  };

  if (unavailable) {
    return (
      <div className="mt-6">
        <Link
          href="/auth/login"
          className="flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          เข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      <button
        type="button"
        onClick={() => finishNotice("/auth/register")}
        disabled={isSigningOut}
        className="flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
      >
        สมัครใหม่
      </button>
      <button
        type="button"
        onClick={() => finishNotice("/auth/login")}
        disabled={isSigningOut}
        className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        ออกจากระบบ
      </button>
      <Link
        href="/"
        className="flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        กลับไปหน้าแรก
      </Link>
    </div>
  );
}

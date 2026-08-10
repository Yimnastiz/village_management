"use client";

import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { clearLoginOtpState, signOutCurrentSession } from "@/lib/auth-client";

export function DuplicateAccountActions() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { error: showError } = useToast();

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);
    try {
      if (!(await signOutCurrentSession())) {
        throw new Error("Sign-out was not confirmed by the server.");
      }
      clearLoginOtpState();
      window.location.replace("/auth/login");
    } catch {
      showError("ไม่สามารถออกจากระบบได้", "กรุณาลองอีกครั้ง");
      setIsSigningOut(false);
    }
  };

  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      <Link
        href="/auth/register"
        className="flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
      >
        สมัครใหม่
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
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

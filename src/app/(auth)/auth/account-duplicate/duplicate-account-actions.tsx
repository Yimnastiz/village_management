"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearLoginOtpState, signOut } from "@/lib/auth-client";

export function DuplicateAccountActions() {
  const router = useRouter();

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
        onClick={async () => {
          try {
            await signOut();
          } finally {
            clearLoginOtpState();
            router.replace("/auth/login");
            router.refresh();
          }
        }}
        className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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

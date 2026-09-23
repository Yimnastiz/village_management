"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOutCurrentSession } from "@/lib/auth-client";

export function MigrationRequiredActions() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = async () => {
    setIsPending(true);
    setError(null);
    try {
      await signOutCurrentSession();
      router.replace("/auth/login");
      router.refresh();
    } catch {
      setError("ไม่สามารถออกจากระบบได้ กรุณาลองใหม่");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="mt-6 space-y-3">
      <button type="button" onClick={signOut} disabled={isPending} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60">
        {isPending ? "กำลังออกจากระบบ..." : "ออกจากบัญชีเดิมและกลับหน้าเข้าสู่ระบบ"}
      </button>
      <Link href="/auth/register" className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">ขอเปิดบัญชีบ้าน</Link>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

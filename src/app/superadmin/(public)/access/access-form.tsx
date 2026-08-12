"use client";

import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";

const accessErrors: Record<string, string> = {
  INVALID: "รหัสการเข้าถึงไม่ถูกต้อง",
  NOT_CONFIGURED: "ระบบ Super Admin ยังไม่ได้ตั้งค่าการเข้าถึง กรุณาตรวจสอบไฟล์ .env.local และเริ่มเซิร์ฟเวอร์ใหม่",
  RATE_LIMITED: "มีการพยายามเข้าสู่ระบบหลายครั้ง กรุณาลองใหม่ภายหลัง",
};

export function SuperAdminAccessForm({ configured }: { configured: boolean }) {
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!configured || loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/superadmin/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
        credentials: "same-origin",
      });

      if (response.ok) {
        window.location.assign("/superadmin/dashboard");
        return;
      }

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(accessErrors[body?.error ?? ""] ?? "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่");
    } catch {
      setError("ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/10 sm:p-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-slate-900">Super Admin</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">เข้าสู่ระบบจัดการส่วนกลาง</p>

        {!configured ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
            <p className="font-semibold">ยังไม่ได้ตั้งค่า Super Admin</p>
            <p className="mt-1 leading-6">กรุณาตั้ง SUPERADMIN_ACCESS_CODE และ SUPERADMIN_SESSION_SECRET ในไฟล์ .env.local แล้วเริ่มเซิร์ฟเวอร์ใหม่</p>
          </div>
        ) : null}

        <form className="mt-7 space-y-4" onSubmit={submit}>
          <div className="grid gap-2">
            <label htmlFor="superadmin-access-code" className="text-sm font-medium text-slate-700">รหัสการเข้าถึง</label>
            <div className="relative">
              <input
                id="superadmin-access-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                type={showCode ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                disabled={loading}
                className="min-h-12 w-full rounded-lg border border-slate-300 px-3 pr-12 text-base outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowCode((value) => !value)}
                disabled={loading}
                className="absolute inset-y-0 right-0 min-w-12 px-3 text-slate-500 hover:text-slate-700 disabled:cursor-not-allowed"
                aria-label={showCode ? "ซ่อนรหัส" : "แสดงรหัส"}
              >
                {showCode ? <EyeOff className="mx-auto h-5 w-5" /> : <Eye className="mx-auto h-5 w-5" />}
              </button>
            </div>
          </div>

          {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm leading-6 text-red-700">{error}</p> : null}

          <button
            disabled={!configured || loading || !code.trim()}
            className="min-h-12 w-full rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        {!configured ? <p className="mt-3 text-center text-xs leading-5 text-slate-500">กรุณาตั้งค่ารหัส Super Admin ใน .env.local ก่อนใช้งาน</p> : null}
      </section>
    </main>
  );
}

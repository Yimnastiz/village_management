"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearLoginOtpState, loadLoginOtpState } from "@/lib/auth-client";
import { sanitizeInternalCallbackUrl } from "@/lib/callback-url";

export default function VerifyHeadmanOtpPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const state = loadLoginOtpState();
    if (!state) {
      router.replace("/auth/login");
      return;
    }
    setPhoneNumber(state.phoneNumber);
  }, [router]);

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("กรุณากรอกรหัส OTP 6 หลัก");
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "ไม่สามารถยืนยัน OTP ได้");

      const loginState = loadLoginOtpState();
      const routingResponse = await fetch("/api/auth/post-login-route", { credentials: "include" });
      const routing = (await routingResponse.json().catch(() => null)) as { landingPath?: string } | null;
      if (!routingResponse.ok || !routing?.landingPath) throw new Error("ไม่สามารถกำหนดหน้าหลังเข้าสู่ระบบได้");
      clearLoginOtpState();
      router.replace(sanitizeInternalCallbackUrl(loginState?.callbackUrl) ?? routing.landingPath);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถยืนยัน OTP ได้");
    } finally {
      setIsPending(false);
    }
  };

  const resend = async () => {
    if (!phoneNumber) return;
    setIsPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phoneNumber, intent: "RESEND" }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "ยังไม่สามารถส่ง OTP ใหม่ได้");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ยังไม่สามารถส่ง OTP ใหม่ได้");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/90 bg-white/90 p-6 shadow-xl shadow-emerald-950/10 ring-1 ring-emerald-100/80 backdrop-blur sm:p-8">
      <p className="text-sm font-semibold text-green-700">เข้าสู่ระบบผู้ใหญ่บ้าน</p>
      <h1 className="mt-2 text-xl font-bold text-gray-900">ยืนยันรหัส OTP ทางโทรศัพท์</h1>
      <p className="mt-2 text-sm text-gray-600">กรอกรหัส 6 หลักที่ส่งไปยังเบอร์โทรศัพท์ของบัญชีผู้ใหญ่บ้าน</p>
      <form onSubmit={verify} className="mt-6 space-y-4">
        <Input id="headman-otp" name="code" label="รหัส OTP" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" className="w-full" isLoading={isPending}>ยืนยันและเข้าสู่ระบบ</Button>
      </form>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <button type="button" onClick={resend} disabled={isPending || !phoneNumber} className="font-medium text-green-700 disabled:text-gray-400">ส่งรหัสใหม่</button>
        <Link href="/auth/login" className="text-gray-600 hover:text-gray-900">กลับหน้าเข้าสู่ระบบ</Link>
      </div>
    </div>
  );
}

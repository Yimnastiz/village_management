"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveLoginOtpState } from "@/lib/auth-client";
import { sanitizeInternalCallbackUrl } from "@/lib/callback-url";

type LoginMode = "HOUSE" | "HEADMAN_PHONE";

function normalizePhone10(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

function LoginContent() {
  const [mode, setMode] = useState<LoginMode>("HOUSE");
  const [houseNumber, setHouseNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error: showError } = useToast();

  const callbackUrl = sanitizeInternalCallbackUrl(searchParams.get("callbackUrl"));
  const registered = (searchParams.get("registered") ?? "").trim() === "success";
  const deletionPending = searchParams.get("accountDeletion") === "pending";
  const registerHref = callbackUrl
    ? `/auth/register?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/auth/register";

  const switchMode = (nextMode: LoginMode) => {
    setMode(nextMode);
    setError(null);
  };

  const handleHouseLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!houseNumber.trim() || !email.trim()) {
      setError("กรุณากรอกบ้านเลขที่และอีเมล");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/house-login/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ houseNumber, email, callbackUrl }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
        landingPath?: string;
      } | null;
      if (response.status === 409 && data?.landingPath) {
        router.replace(data.landingPath);
        return;
      }
      if (!response.ok) throw new Error(data?.error || "ไม่สามารถเริ่มเข้าสู่ระบบได้");
      success(
        "ตรวจสอบอีเมลของคุณ",
        data?.message || "หากข้อมูลถูกต้อง ระบบจะส่งรหัสยืนยันไปยังอีเมลที่ระบุ",
      );
      router.push("/auth/login/verify-email");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "ไม่สามารถเริ่มเข้าสู่ระบบได้";
      setError(message);
      showError("เริ่มเข้าสู่ระบบไม่สำเร็จ", message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedPhone = normalizePhone10(phone);
    if (!/^\d{10}$/.test(normalizedPhone)) {
      setError("กรุณากรอกเบอร์โทรศัพท์ 10 หลัก");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const registrationResponse = await fetch("/api/auth/check-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phoneNumber: normalizedPhone }),
      });
      if (!registrationResponse.ok) {
        const data = (await registrationResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "ไม่พบบัญชีที่ใช้เบอร์โทรศัพท์นี้");
      }
      const registrationData = (await registrationResponse.json()) as { phoneNumber?: string };
      const loginPhoneNumber = registrationData.phoneNumber ?? normalizedPhone;
      const result = await fetch("/api/auth/login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phoneNumber: loginPhoneNumber, intent: "START_OR_RESUME" }),
      });
      if (!result.ok) throw new Error("ไม่สามารถส่งรหัส OTP ได้");
      const resultBody = (await result.json()) as {
        outcome?: "OTP_SENT" | "DEV_OTP_READY" | "RESUME_EXISTING_CHALLENGE" | "LOCKED";
      };
      saveLoginOtpState(loginPhoneNumber, callbackUrl, resultBody.outcome);
      success("ส่งรหัส OTP แล้ว", "กรุณาตรวจสอบข้อความ SMS");
      router.push("/auth/verify-otp?mode=signin");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "ไม่สามารถส่งรหัส OTP ได้";
      setError(message);
      showError("ส่งรหัส OTP ไม่สำเร็จ", message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/90 bg-white/90 p-6 shadow-xl shadow-emerald-950/10 ring-1 ring-emerald-100/80 backdrop-blur sm:p-8">
      <h2 className="text-xl font-bold text-gray-900">เข้าสู่ระบบ</h2>
      <p className="mt-2 text-sm text-gray-500">บัญชีบ้านใช้บ้านเลขที่และอีเมลที่ผ่านการยืนยันแล้ว</p>

      <div className="mt-5 grid grid-cols-2 rounded-xl bg-gray-100 p-1" role="tablist" aria-label="วิธีเข้าสู่ระบบ">
        <button type="button" role="tab" aria-selected={mode === "HOUSE"} onClick={() => switchMode("HOUSE")} className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition ${mode === "HOUSE" ? "bg-white text-green-700 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}>
          บัญชีบ้าน
        </button>
        <button type="button" role="tab" aria-selected={mode === "HEADMAN_PHONE"} onClick={() => switchMode("HEADMAN_PHONE")} className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition ${mode === "HEADMAN_PHONE" ? "bg-white text-green-700 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}>
          ผู้ใหญ่บ้าน
        </button>
      </div>

      {registered ? <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">ส่งคำขอเปิดบัญชีบ้านแล้ว กรุณารอการตรวจสอบ เมื่ออนุมัติแล้วจึงเข้าสู่ระบบด้วยอีเมลได้</div> : null}
      {deletionPending ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">บัญชีอยู่ระหว่างระยะผ่อนผันการปิด 7 วัน</div> : null}

      {mode === "HOUSE" ? (
        <form onSubmit={handleHouseLogin} className="mt-5 space-y-4">
          <Input id="house-login-number" name="houseNumber" label="บ้านเลขที่" placeholder="168/4" value={houseNumber} onChange={(event) => setHouseNumber(event.target.value)} autoComplete="off" maxLength={50} required />
          <Input id="house-login-email" name="email" label="อีเมล" type="email" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={320} required />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" className="w-full" isLoading={isLoading}>ส่งรหัสยืนยัน</Button>
          <p className="text-xs leading-5 text-gray-500">หากข้อมูลถูกต้อง ระบบจะส่งรหัสยืนยันไปยังอีเมลที่ระบุ</p>
        </form>
      ) : (
        <form onSubmit={handlePhoneLogin} className="mt-5 space-y-4">
          <p className="text-sm leading-6 text-gray-600">สำหรับบัญชีผู้ใหญ่บ้านเท่านั้น บัญชีบ้านเข้าสู่ระบบด้วยอีเมล</p>
          <Input id="login-phone" name="phoneNumber" label="เบอร์โทรศัพท์" type="tel" placeholder="0812345678" value={phone} onChange={(event) => setPhone(normalizePhone10(event.target.value))} inputMode="numeric" maxLength={10} pattern="[0-9]{10}" autoComplete="tel" required />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" className="w-full" isLoading={isLoading}>ส่งรหัส OTP ทางโทรศัพท์</Button>
        </form>
      )}

      <div className="mt-6 text-center text-sm text-gray-600">
        บ้านของคุณยังไม่มีบัญชี?{" "}
        <Link href={registerHref} className="font-medium text-green-600 hover:underline">ขอเปิดบัญชีบ้าน</Link>
      </div>
    </div>
  );
}

export function LoginForm() {
  return <Suspense fallback={<div>Loading...</div>}><LoginContent /></Suspense>;
}

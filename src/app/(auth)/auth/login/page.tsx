"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { saveLoginOtpState } from "@/lib/auth-client";
import { sanitizeInternalCallbackUrl } from "@/lib/callback-url";

function normalizePhone10(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

function LoginContent() {
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const callbackUrl = sanitizeInternalCallbackUrl(searchParams.get("callbackUrl"));
  const registered = (searchParams.get("registered") ?? "").trim() === "success";
  const deletionPending = searchParams.get("accountDeletion") === "pending";
  const registerHref = callbackUrl
    ? `/auth/register?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/auth/register";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedPhone = normalizePhone10(phone);
    if (!normalizedPhone) {
      setError("Please enter a phone number.");
      return;
    }

    if (!/^\d{10}$/.test(normalizedPhone)) {
      setError("Phone number must be exactly 10 digits.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const registrationResponse = await fetch("/api/auth/check-registration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          phoneNumber: normalizedPhone,
        }),
      });

      if (!registrationResponse.ok) {
        const registrationError = (await registrationResponse.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(
          registrationError?.error ??
            "This phone number is not registered yet. Please register first."
        );
      }

      const registrationData = (await registrationResponse.json()) as {
        phoneNumber?: string;
      };
      const loginPhoneNumber = registrationData.phoneNumber ?? normalizedPhone;

      const result = await fetch("/api/auth/login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phoneNumber: loginPhoneNumber, intent: "START_OR_RESUME" }),
      });
      if (!result.ok) {
        const body = (await result.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to send OTP.");
      }
      const resultBody = (await result.json()) as { outcome?: "OTP_SENT" | "RESUME_EXISTING_CHALLENGE" | "LOCKED" };

      // Login state is tab-scoped and short-lived. Do not expose the phone
      // number in browser history, logs, referrers, or registration storage.
      saveLoginOtpState(loginPhoneNumber, callbackUrl, resultBody.outcome);
      router.push("/auth/verify-otp?mode=signin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/90 bg-white/90 p-6 shadow-xl shadow-emerald-950/10 ring-1 ring-emerald-100/80 backdrop-blur sm:p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-2">เข้าสู่ระบบ</h2>
      <p className="text-sm text-gray-500 mb-6">
        กรอกเบอร์โทรศัพท์เพื่อรับรหัส OTP สำหรับผู้ใช้ที่มีบัญชีแล้ว
      </p>

      {registered && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          สมัครลงทะเบียนเสร็จสิ้นแล้ว สามารถล็อกอินเข้าเว็บไซต์ได้
        </div>
      )}
      {deletionPending ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><p>บัญชีอยู่ระหว่างระยะผ่อนผันการปิด 7 วัน คุณสามารถยกเลิกคำขอจาก Browser เดิมได้</p><button type="button" className="mt-2 font-medium underline" onClick={async () => { const response = await fetch("/api/auth/account-deletion", { method: "DELETE" }); if (response.ok) router.replace("/auth/login?accountDeletion=cancelled"); else setError("ไม่สามารถยกเลิกคำขอได้"); }}>ยกเลิกคำขอปิดบัญชี</button></div> : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="เบอร์โทรศัพท์"
          type="tel"
          placeholder="0812345678"
          value={phone}
          onChange={(e) => setPhone(normalizePhone10(e.target.value))}
            inputMode="numeric"
            maxLength={10}
            pattern="[0-9]{10}"
            autoComplete="tel"
            title="Phone number must be exactly 10 digits"
          required
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" className="w-full" isLoading={isLoading}>
          ส่งรหัส OTP
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        ยังไม่มีบัญชี?{" "}
        <Link href={registerHref} className="text-green-600 font-medium hover:underline">
          สมัครสมาชิก
        </Link>
      </div>

      <div className="mt-2 text-center text-sm text-gray-600">
        <Link href="/auth/forgot" className="text-green-600 hover:underline">
          ลืมรหัสผ่าน?
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}

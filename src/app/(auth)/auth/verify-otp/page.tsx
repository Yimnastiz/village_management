"use client";

import { Suspense, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type VerifyMode = "signin" | "signup";

function VerifyOTPContent() {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();

  const mode = (searchParams.get("mode") ?? "signin") as VerifyMode;
  const phone = (searchParams.get("phone") ?? "").trim();
  const nationalId = (searchParams.get("nationalId") ?? "").trim();
  const registrationModeRaw = (searchParams.get("registrationMode") ?? "resident").trim();
  const registrationMode = registrationModeRaw === "headman" ? "headman" : "resident";
  const name = (searchParams.get("name") ?? "").trim();
  const province = (searchParams.get("province") ?? "").trim();
  const district = (searchParams.get("district") ?? "").trim();
  const subdistrict = (searchParams.get("subdistrict") ?? "").trim();
  const villageId = (searchParams.get("villageId") ?? "").trim();
  const callbackUrl = (searchParams.get("callbackUrl") ?? "").trim() || null;

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) {
      return;
    }

    const nextOtp = [...otp];
    nextOtp[index] = value.slice(-1);
    setOtp(nextOtp);

    if (value && index < otp.length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (!phone) {
      setError("ไม่พบเบอร์โทรศัพท์ กรุณากลับไปเริ่มใหม่");
      return;
    }

    setIsResending(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await authClient.phoneNumber.sendOtp({ phoneNumber: phone });

      if ((result as { error?: { message?: string } | null })?.error) {
        throw new Error(
          (result as { error?: { message?: string } | null }).error?.message ??
            "ส่ง OTP ซ้ำไม่สำเร็จ"
        );
      }

      setSuccessMessage("ส่ง OTP ใหม่แล้ว กรุณาตรวจสอบข้อความ SMS");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่ง OTP ซ้ำไม่สำเร็จ");
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone) {
      setError("ไม่พบเบอร์โทรศัพท์ กรุณากลับไปเริ่มใหม่");
      return;
    }

    const code = otp.join("");
    if (code.length !== 6) {
      setError("กรุณากรอก OTP ให้ครบ 6 หลัก");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload: Record<string, unknown> = {
        phoneNumber: phone,
        code,
      };

      if (mode === "signup" && name) {
        payload.name = name;
      }

      const verifyResult = await authClient.phoneNumber.verify(payload);

      if ((verifyResult as { error?: { message?: string } | null })?.error) {
        throw new Error(
          (verifyResult as { error?: { message?: string } | null }).error?.message ??
            "Invalid or expired OTP."
        );
      }

      let resolvedLandingPath: string | null = null;

      if (mode === "signup") {
        if (!name || !nationalId || !province || !district || !subdistrict || !villageId) {
          throw new Error("ข้อมูลสมัครสมาชิกไม่ครบถ้วน กรุณาเริ่มสมัครใหม่");
        }

        const completeSignupResponse = await fetch("/api/auth/complete-signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            name,
            nationalId,
            registrationMode,
            province,
            district,
            subdistrict,
            villageId,
          }),
        });

        if (!completeSignupResponse.ok) {
          const failure = (await completeSignupResponse.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(failure?.error ?? "Failed to complete signup flow.");
        }

        const completeSignupData = (await completeSignupResponse.json()) as {
          landingPath?: string;
        };
        resolvedLandingPath = completeSignupData.landingPath ?? null;
      }

      if (!resolvedLandingPath) {
        const postLoginResponse = await fetch("/api/auth/post-login-route", {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (postLoginResponse.ok) {
          const postLoginData = (await postLoginResponse.json()) as {
            landingPath?: string;
          };
          resolvedLandingPath = postLoginData.landingPath ?? null;
        }
      }

      router.push(callbackUrl ?? resolvedLandingPath ?? "/auth/binding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ยืนยัน OTP ไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-2">ยืนยันรหัส OTP</h2>
      <p className="text-sm text-gray-500 mb-6">
        กรอกรหัส OTP 6 หลักที่ส่งไปยังเบอร์ {phone || "ของคุณ"}
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex gap-2 justify-center">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="h-11 w-11 text-center text-xl font-bold border-2 rounded-xl focus:outline-none focus:border-green-500 sm:h-12 sm:w-12"
            />
          ))}
        </div>

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        {successMessage && <p className="text-sm text-green-600 text-center">{successMessage}</p>}

        <Button type="submit" className="w-full" isLoading={isLoading}>
          ยืนยัน OTP
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-500">
        ยังไม่ได้รับ OTP?{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={isResending}
          className="text-green-600 hover:underline disabled:opacity-50"
        >
          {isResending ? "กำลังส่ง..." : "ส่งอีกครั้ง"}
        </button>
      </p>
    </div>
  );
}

export default function VerifyOTPPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyOTPContent />
    </Suspense>
  );
}

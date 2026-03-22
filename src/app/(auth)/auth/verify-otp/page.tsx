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
      setError("Phone number not found. Please go back and try again.");
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
            "Failed to resend OTP."
        );
      }

      setSuccessMessage("A new OTP has been sent. Check your server logs.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend OTP.");
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone) {
      setError("Phone number not found. Please go back and try again.");
      return;
    }

    const code = otp.join("");
    if (code.length !== 6) {
      setError("Please enter the full 6-digit OTP.");
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
        if (!name || !province || !district || !subdistrict || !villageId) {
          throw new Error("Missing registration info. Please restart signup.");
        }

        const completeSignupResponse = await fetch("/api/auth/complete-signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            name,
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
      setError(err instanceof Error ? err.message : "OTP verification failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Verify OTP</h2>
      <p className="text-sm text-gray-500 mb-6">
        Enter the 6-digit OTP sent to {phone || "your phone number"}.
      </p>

      {/* Dev mode hint */}
      <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-700">
          💡 <strong>Dev Mode:</strong> Check your terminal/server logs for the OTP code. Or enter any 6-digit code.
        </p>
      </div>

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
              className="w-12 h-12 text-center text-xl font-bold border-2 rounded-xl focus:outline-none focus:border-green-500"
            />
          ))}
        </div>

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        {successMessage && <p className="text-sm text-green-600 text-center">{successMessage}</p>}

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Verify OTP
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-500">
        Did not receive OTP?{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={isResending}
          className="text-green-600 hover:underline disabled:opacity-50"
        >
          {isResending ? "Sending..." : "Resend"}
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

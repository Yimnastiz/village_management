"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

function normalizePhone10(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

function LoginContent() {
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const callbackUrl = (searchParams.get("callbackUrl") ?? "").trim() || null;
  const registerHref = callbackUrl
    ? `/auth/register?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/auth/register";

  const isDevHeadmanBypassEnabled =
    process.env.NEXT_PUBLIC_DEV_BYPASS_OTP_HEADMAN === "true";

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
      if (isDevHeadmanBypassEnabled) {
        const headmanBypassResponse = await fetch("/api/auth/dev-headman-login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            phoneNumber: normalizedPhone,
          }),
        });

        if (headmanBypassResponse.ok) {
          const bypassData = (await headmanBypassResponse.json()) as {
            landingPath?: string;
          };
          router.push(bypassData.landingPath ?? "/admin/settings/village");
          return;
        }

        if (
          headmanBypassResponse.status !== 403 &&
          headmanBypassResponse.status !== 404
        ) {
          const bypassError = (await headmanBypassResponse.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(
            bypassError?.error ?? "Headman login bypass failed."
          );
        }
      }

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
        const registrationError =
          (await registrationResponse.json().catch(() => null)) as
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

      const result = await authClient.phoneNumber.sendOtp({
        phoneNumber: loginPhoneNumber,
      });

      if ((result as { error?: { message?: string } | null })?.error) {
        throw new Error(
          (result as { error?: { message?: string } | null }).error?.message ??
            "Failed to send OTP."
        );
      }

      const params = new URLSearchParams({
        mode: "signin",
        phone: loginPhoneNumber,
      });
      if (callbackUrl) {
        params.set("callbackUrl", callbackUrl);
      }
      router.push(`/auth/verify-otp?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Sign In</h2>
      <p className="text-sm text-gray-500 mb-6">Enter your phone number to receive an OTP.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Phone Number"
          type="tel"
          placeholder="0812345678"
          value={phone}
          onChange={(e) => setPhone(normalizePhone10(e.target.value))}
          inputMode="numeric"
          maxLength={10}
          pattern="[0-9]{10}"
          title="Phone number must be exactly 10 digits"
          required
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Send OTP
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        No account yet?{" "}
        <Link href={registerHref} className="text-green-600 font-medium hover:underline">
          Register
        </Link>
      </div>

      <div className="mt-2 text-center text-sm text-gray-600">
        <Link href="/auth/forgot" className="text-green-600 hover:underline">
          Forgot password?
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

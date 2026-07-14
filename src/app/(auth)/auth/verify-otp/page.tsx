"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type VerifyMode = "signin" | "signup";

type RegistrationDraft = {
  registrationId?: string;
  mode: VerifyMode;
  phone?: string;
  registrationMode?: string;
  name?: string;
  nationalId?: string;
  province?: string;
  district?: string;
  subdistrict?: string;
  villageId?: string;
  callbackUrl?: string;
  rejectReason?: string | null;
  otpLockedUntil?: string | null;
  savedAt: number;
};

const REGISTRATION_DRAFT_KEY = "village_auth_registration_draft";

function loadRegistrationDraft(): RegistrationDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(REGISTRATION_DRAFT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as RegistrationDraft;
    if (!parsed?.savedAt || typeof parsed.savedAt !== "number") return null;

    if (Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
      window.localStorage.removeItem(REGISTRATION_DRAFT_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function clearRegistrationDraft() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(REGISTRATION_DRAFT_KEY);
  }
}

function VerifyOTPContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [draft, setDraft] = useState<RegistrationDraft | null>(null);
  const [serverDraft, setServerDraft] = useState<RegistrationDraft | null>(null);
  const [isServerDraftLoaded, setIsServerDraftLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const modeParam = searchParams.get("mode") as VerifyMode | null;
  const registrationId = searchParams.get("registrationId")?.trim() || null;
  const callbackUrl = searchParams.get("callbackUrl")?.trim() || null;

  const mode = modeParam ?? draft?.mode ?? serverDraft?.mode ?? "signin";
  const activeDraft = mode === "signup" ? serverDraft ?? draft : null;
  const phone = (activeDraft?.phone ?? "").trim();
  const nationalId = (activeDraft?.nationalId ?? "").trim();
  const registrationMode = (activeDraft?.registrationMode ?? "resident").trim() === "headman" ? "headman" : "resident";
  const name = (activeDraft?.name ?? "").trim();
  const province = (activeDraft?.province ?? "").trim();
  const district = (activeDraft?.district ?? "").trim();
  const subdistrict = (activeDraft?.subdistrict ?? "").trim();
  const villageId = (activeDraft?.villageId ?? "").trim();

  useEffect(() => {
    const storedDraft = loadRegistrationDraft();
    if (storedDraft) {
      setDraft(storedDraft);
    }
  }, []);

  useEffect(() => {
    const initialMode = modeParam ?? draft?.mode ?? "signin";
    if (initialMode !== "signup" || isServerDraftLoaded) {
      return;
    }

    const resumeUrl = registrationId
      ? `/api/auth/resume-registration?registrationId=${encodeURIComponent(registrationId)}`
      : "/api/auth/resume-registration";

    fetch(resumeUrl, { method: "GET", credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errorBody?.error ?? "ไม่มีการสมัครสมาชิกที่รอดำเนินการหรือหมดเวลาแล้ว");
        }

        const data = (await response.json()) as { ok: boolean; data?: RegistrationDraft };
        if (!data.ok || !data.data) {
          throw new Error("ไม่มีการสมัครสมาชิกที่รอดำเนินการหรือหมดเวลาแล้ว");
        }

        setServerDraft(data.data);
      })
      .catch((err) => {
        setResumeError(err instanceof Error ? err.message : "ไม่สามารถโหลดการสมัครสมาชิกที่ค้างอยู่ได้");
      })
      .finally(() => {
        setIsServerDraftLoaded(true);
      });
  }, [draft?.mode, isServerDraftLoaded, modeParam, registrationId]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

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

    if (mode === "signup" && (!name || !nationalId || !province || !district || !subdistrict || !villageId)) {
      setError("ไม่พบข้อมูลการสมัครสมาชิก กรุณากลับไปเริ่มสมัครใหม่");
      return;
    }

    setIsResending(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (mode === "signup") {
        const resendResponse = await fetch("/api/auth/start-registration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            phoneNumber: phone,
            registrationMode,
            name,
            nationalId,
            province,
            district,
            subdistrict,
            villageId,
            callbackUrl,
          }),
        });

        if (!resendResponse.ok) {
          const resendError = (await resendResponse.json().catch(() => null)) as { error?: string } | null;
          throw new Error(resendError?.error ?? "ส่ง OTP ซ้ำไม่สำเร็จ");
        }

        const resendData = (await resendResponse.json().catch(() => null)) as { registrationId?: string } | null;
        if (resendData?.registrationId) {
          const nextParams = new URLSearchParams();
          nextParams.set("mode", "signup");
          nextParams.set("registrationId", resendData.registrationId);
          if (callbackUrl) {
            nextParams.set("callbackUrl", callbackUrl);
          }
          router.replace(`/auth/verify-otp?${nextParams.toString()}`);
        }
      } else {
        const resendResult = await authClient.phoneNumber.sendOtp({ phoneNumber: phone });
        if ((resendResult as { error?: { message?: string } | null })?.error) {
          throw new Error((resendResult as { error?: { message?: string } | null }).error?.message ?? "ส่ง OTP ซ้ำไม่สำเร็จ");
        }
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
      if (mode === "signup") {
        const verifyResponse = await fetch("/api/auth/verify-registration-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ code }),
        });

        if (!verifyResponse.ok) {
          const verifyError = (await verifyResponse.json().catch(() => null)) as { error?: string } | null;
          throw new Error(verifyError?.error ?? "Invalid or expired OTP.");
        }
      } else {
        const verifyResult = await authClient.phoneNumber.verify({ phoneNumber: phone, code });
        if ((verifyResult as { error?: { message?: string } | null })?.error) {
          throw new Error((verifyResult as { error?: { message?: string } | null }).error?.message ?? "Invalid or expired OTP.");
        }
      }

      if (mode === "signup") {
        setSuccessMessage("สมัครลงทะเบียนเสร็จสิ้นแล้ว สามารถล็อกอินเข้าเว็บไซต์ได้");
        setTimeout(() => {
          router.push("/auth/login?registered=success");
        }, 700);
      } else {
        let resolvedLandingPath: string | null = null;
        const postLoginResponse = await fetch("/api/auth/post-login-route", {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });

        if (postLoginResponse.ok) {
          const postLoginData = (await postLoginResponse.json()) as { landingPath?: string };
          resolvedLandingPath = postLoginData.landingPath ?? null;
        }

        router.push(resolvedLandingPath ?? "/resident/dashboard");
      }

      clearRegistrationDraft();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ยืนยัน OTP ไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-6 shadow-lg sm:p-8">
      <h2 className="mb-2 text-xl font-bold text-gray-900">ยืนยันรหัส OTP</h2>
      <p className="mb-6 text-sm text-gray-500">กรอกรหัส OTP 6 หลักที่ส่งไปยังเบอร์ {phone || "ของคุณ"}</p>

      {resumeError ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{resumeError}</div> : null}

      {mode === "signup" && activeDraft ? (
        <div className="mb-4 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-sm text-gray-700">ข้อมูลการสมัคร</p>
          <p className="text-sm text-gray-600">ชื่อ: {name}</p>
          <p className="text-sm text-gray-600">เบอร์โทร: {phone}</p>
          <p className="text-sm text-gray-600">หมู่บ้าน: {province} {district} {subdistrict}</p>
          {activeDraft.rejectReason ? <p className="text-sm text-red-700">เหตุผลการปฏิเสธ: {activeDraft.rejectReason}</p> : null}
          {activeDraft.otpLockedUntil ? (
            <p className="text-sm text-red-700">ระบบถูกล็อกชั่วคราวจนถึง {new Date(activeDraft.otpLockedUntil).toLocaleString("th-TH")}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams();
                if (callbackUrl) {
                  params.set("callbackUrl", callbackUrl);
                }
                router.push(`/auth/register${params.toString() ? `?${params.toString()}` : ""}`);
              }}
              className="text-sm text-green-600 hover:underline"
            >
              แก้ไขข้อมูลการสมัคร
            </button>
            <button
              type="button"
              onClick={async () => {
                setIsLoading(true);
                setError(null);
                try {
                  const cancelResponse = await fetch("/api/auth/cancel-registration", {
                    method: "POST",
                    credentials: "include",
                  });

                  if (!cancelResponse.ok) {
                    const cancelError = (await cancelResponse.json().catch(() => null)) as { error?: string } | null;
                    throw new Error(cancelError?.error ?? "ไม่สามารถยกเลิกการสมัครสมาชิกได้ กรุณาลองใหม่");
                  }

                  const params = new URLSearchParams();
                  if (callbackUrl) {
                    params.set("callbackUrl", callbackUrl);
                  }
                  router.push(`/auth/register${params.toString() ? `?${params.toString()}` : ""}`);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "ไม่สามารถยกเลิกการสมัครสมาชิกได้");
                } finally {
                  setIsLoading(false);
                }
              }}
              className="text-sm text-red-600 hover:underline"
            >
              ยกเลิกการสมัคร
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-center gap-2">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(event) => handleChange(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              className="h-11 w-11 rounded-xl border-2 text-center text-xl font-bold focus:border-green-500 focus:outline-none sm:h-12 sm:w-12"
            />
          ))}
        </div>

        {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
        {successMessage ? <p className="text-center text-sm text-green-600">{successMessage}</p> : null}

        <Button type="submit" className="w-full" isLoading={isLoading}>
          ยืนยัน OTP
        </Button>
      </form>

      <div className="mt-4 space-y-3 text-center text-sm text-gray-500">
        <p>
          ยังไม่ได้รับ OTP?{" "}
          <button type="button" onClick={handleResend} disabled={isResending} className="text-green-600 hover:underline disabled:opacity-50">
            {isResending ? "กำลังส่ง..." : "ส่งอีกครั้ง"}
          </button>
        </p>
        <p>
          <Link href="/" className="text-green-600 hover:underline">
            กลับสู่หน้าเว็บไซต์สาธารณะ
          </Link>
        </p>
      </div>
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
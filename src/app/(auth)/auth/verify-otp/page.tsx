"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  clearLoginOtpState,
  loadLoginOtpState,
  type LoginOtpState,
} from "@/lib/auth-client";
import { sanitizeInternalCallbackUrl } from "@/lib/callback-url";

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
  otpSentAt?: string | null;
  expiresAt?: string | null;
  resendAvailableAt?: string | null;
  failedCount?: number;
  remainingAttempts?: number;
  challengeId?: string;
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
  const [loginState, setLoginState] = useState<LoginOtpState | null>(null);
  const [serverDraft, setServerDraft] = useState<RegistrationDraft | null>(null);
  const [isServerDraftLoaded, setIsServerDraftLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [otpSeconds, setOtpSeconds] = useState(0);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [challengeTiming, setChallengeTiming] = useState<{
    expiresAt: string;
    resendAvailableAt: string;
    otpLockedUntil?: string | null;
    remainingAttempts?: number;
  } | null>(null);

  const rawMode = searchParams.get("mode");
  const mode: VerifyMode = rawMode === "signup" ? "signup" : "signin";
  const registrationId = searchParams.get("registrationId")?.trim() || null;
  const resumedRegistration = mode === "signup" && searchParams.get("resumed") === "1";
  const signupCallbackUrl = sanitizeInternalCallbackUrl(searchParams.get("callbackUrl"));

  const activeDraft = mode === "signup" ? serverDraft ?? draft : null;
  const phone = mode === "signup"
    ? (activeDraft?.phone ?? "").trim()
    : (loginState?.phoneNumber ?? "").trim();
  const callbackUrl = mode === "signup"
    ? signupCallbackUrl
    : sanitizeInternalCallbackUrl(loginState?.callbackUrl);
  const nationalId = (activeDraft?.nationalId ?? "").trim();
  const name = (activeDraft?.name ?? "").trim();
  const province = (activeDraft?.province ?? "").trim();
  const district = (activeDraft?.district ?? "").trim();
  const subdistrict = (activeDraft?.subdistrict ?? "").trim();
  const villageId = (activeDraft?.villageId ?? "").trim();
  const maskedPhone = phone.length === 10
    ? `${phone.slice(0, 2)}X-XXX-${phone.slice(-4)}`
    : "เบอร์ของคุณ";
  const isLocked = Boolean(currentTime && challengeTiming?.otpLockedUntil && new Date(challengeTiming.otpLockedUntil).getTime() > currentTime);

  useEffect(() => {
    const updateCountdowns = () => {
      if (!challengeTiming) return;
      const now = Date.now();
      setCurrentTime(now);
      setResendSeconds(Math.max(0, Math.ceil((new Date(challengeTiming.resendAvailableAt).getTime() - now) / 1000)));
      setOtpSeconds(Math.max(0, Math.ceil((new Date(challengeTiming.expiresAt).getTime() - now) / 1000)));
    };
    updateCountdowns();
    const timer = window.setInterval(updateCountdowns, 1000);
    return () => window.clearInterval(timer);
  }, [challengeTiming]);

  useEffect(() => {
    if (mode === "signup") {
      const storedDraft = loadRegistrationDraft();
      if (storedDraft) {
        setDraft(storedDraft);
      }
    } else {
      setLoginState(loadLoginOtpState());
      fetch("/api/auth/login-otp", { credentials: "include" })
        .then(async (response) => {
          const body = (await response.json().catch(() => null)) as { error?: string; data?: RegistrationDraft } | null;
          if (!response.ok || !body?.data?.expiresAt || !body.data.resendAvailableAt) throw new Error(body?.error ?? "Login OTP challenge not found.");
          setChallengeTiming({ expiresAt: body.data.expiresAt, resendAvailableAt: body.data.resendAvailableAt, otpLockedUntil: body.data.otpLockedUntil, remainingAttempts: body.data.remainingAttempts });
        })
        .catch((reason: unknown) => setResumeError(reason instanceof Error ? reason.message : "Login OTP challenge not found."));
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== "signup" || isServerDraftLoaded) {
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
        if (data.data.expiresAt && data.data.resendAvailableAt) {
          setChallengeTiming({ expiresAt: data.data.expiresAt, resendAvailableAt: data.data.resendAvailableAt, otpLockedUntil: data.data.otpLockedUntil });
        }
      })
      .catch((err) => {
        setResumeError(err instanceof Error ? err.message : "ไม่สามารถโหลดการสมัครสมาชิกที่ค้างอยู่ได้");
      })
      .finally(() => {
        setIsServerDraftLoaded(true);
      });
  }, [isServerDraftLoaded, mode, registrationId]);

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

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!digits) return;
    event.preventDefault();
    const nextOtp = Array.from({ length: 6 }, (_, index) => digits[index] ?? "");
    setOtp(nextOtp);
    inputs.current[Math.min(digits.length, 6) - 1]?.focus();
  };

  const handleResend = async () => {
    if (resendSeconds > 0) return;
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
        const resendResponse = await fetch("/api/auth/resend-registration-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
        });

        if (!resendResponse.ok) {
          const resendError = (await resendResponse.json().catch(() => null)) as { error?: string } | null;
          throw new Error(resendError?.error ?? "ส่ง OTP ซ้ำไม่สำเร็จ");
        }

        const resendData = (await resendResponse.json().catch(() => null)) as { registrationId?: string; data?: RegistrationDraft } | null;
        if (resendData?.data?.expiresAt && resendData.data.resendAvailableAt) setChallengeTiming({ expiresAt: resendData.data.expiresAt, resendAvailableAt: resendData.data.resendAvailableAt, otpLockedUntil: resendData.data.otpLockedUntil });
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
        const resendResult = await fetch("/api/auth/login-otp", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ phoneNumber: phone, intent: "RESEND" }) });
        const resendBody = (await resendResult.json().catch(() => null)) as { error?: string; data?: RegistrationDraft } | null;
        if (resendBody?.data?.expiresAt && resendBody.data.resendAvailableAt) setChallengeTiming({ expiresAt: resendBody.data.expiresAt, resendAvailableAt: resendBody.data.resendAvailableAt, otpLockedUntil: resendBody.data.otpLockedUntil, remainingAttempts: resendBody.data.remainingAttempts });
        if (!resendResult.ok) throw new Error(resendBody?.error ?? "ส่ง OTP ซ้ำไม่สำเร็จ");
        setOtp(["", "", "", "", "", ""]);
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
          body: JSON.stringify({ code, registrationId, challengeId: activeDraft?.challengeId }),
        });

        if (!verifyResponse.ok) {
          const verifyError = (await verifyResponse.json().catch(() => null)) as { error?: string } | null;
          throw new Error(verifyError?.error ?? "Invalid or expired OTP.");
        }
      } else {
        const verifyResult = await fetch("/api/auth/login-otp/verify", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ code }) });
        const verifyBody = (await verifyResult.json().catch(() => null)) as { error?: string; data?: RegistrationDraft } | null;
        if (!verifyResult.ok) {
          if (verifyBody?.data?.expiresAt && verifyBody.data.resendAvailableAt) setChallengeTiming({ expiresAt: verifyBody.data.expiresAt, resendAvailableAt: verifyBody.data.resendAvailableAt, otpLockedUntil: verifyBody.data.otpLockedUntil, remainingAttempts: verifyBody.data.remainingAttempts });
          throw new Error(verifyBody?.error ?? "Invalid or expired OTP.");
        }
      }

      if (mode === "signup") {
        setSuccessMessage("สมัครลงทะเบียนเสร็จสิ้นแล้ว สามารถล็อกอินเข้าเว็บไซต์ได้");
        setTimeout(() => {
          router.push("/auth/login?registered=success");
        }, 700);
      } else {
        setSuccessMessage("ยืนยันสำเร็จ กำลังพาไปหน้าถัดไป");
        const postLoginResponse = await fetch("/api/auth/post-login-route", {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });

        if (!postLoginResponse.ok) throw new Error("สร้างการเข้าสู่ระบบสำเร็จไม่สมบูรณ์ กรุณาลองใหม่อีกครั้ง");
        const postLoginData = (await postLoginResponse.json()) as { landingPath?: string };
        if (!postLoginData.landingPath?.startsWith("/")) throw new Error("ไม่พบหน้าปลายทางหลังเข้าสู่ระบบ");
        router.replace(postLoginData.landingPath);
        router.refresh();
        clearLoginOtpState();
      }

      if (mode === "signup") {
        clearRegistrationDraft();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "ยืนยัน OTP ไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/90 bg-white/90 p-6 shadow-xl shadow-emerald-950/10 ring-1 ring-emerald-100/80 backdrop-blur sm:p-8">
      <h2 className="mb-2 text-xl font-bold text-gray-900">ยืนยันรหัส OTP</h2>
      <p className="mb-2 text-sm text-gray-500">กรอกรหัส OTP 6 หลักที่ส่งไปยังเบอร์ {maskedPhone}</p>
      <p className={`mb-6 text-xs ${otpSeconds === 0 ? "text-red-600" : "text-gray-400"}`}>{otpSeconds === 0 ? "OTP หมดอายุแล้ว กรุณากดส่งอีกครั้ง" : <>รหัสจะหมดอายุใน {Math.floor(otpSeconds / 60)}:{String(otpSeconds % 60).padStart(2, "0")} นาที</>}</p>
      {isLocked ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">ระบบถูกล็อกชั่วคราว กรุณารอจนถึง {new Date(challengeTiming!.otpLockedUntil!).toLocaleString("th-TH")}</p> : null}
      {resumedRegistration ? <p className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">พบรหัส OTP ที่ส่งไว้แล้ว กรุณากรอกรหัสที่ได้รับ หรือรอส่งรหัสใหม่</p> : null}
      {mode === "signin" && loginState?.outcome === "RESUME_EXISTING_CHALLENGE" ? <p className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">พบรหัส OTP ที่ส่งไว้แล้ว กรุณากรอกรหัสเดิม หรือรอส่งรหัสใหม่ได้ในอีก {resendSeconds} วินาที</p> : null}
      {mode === "signin" && typeof challengeTiming?.remainingAttempts === "number" ? <p className="mb-4 text-sm text-gray-600">เหลือโอกาสกรอก OTP อีก {challengeTiming.remainingAttempts} ครั้ง</p> : null}

      {resumeError ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{resumeError}</div> : null}

      {mode === "signup" && activeDraft ? (
        <div className="mb-4 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-sm text-gray-700">ข้อมูลการสมัคร</p>
          <p className="text-sm text-gray-600">ชื่อ: {name}</p>
          <p className="text-sm text-gray-600">เบอร์โทร: {maskedPhone}</p>
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
              onPaste={handlePaste}
              disabled={isLoading}
              aria-label={`OTP หลักที่ ${index + 1}`}
              className="h-10 min-w-0 flex-1 rounded-xl border-2 text-center text-lg font-bold focus:border-green-500 focus:outline-none disabled:bg-gray-100 sm:h-12 sm:w-12 sm:flex-none sm:text-xl"
            />
          ))}
        </div>

        {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
        {successMessage ? <p className="text-center text-sm text-green-600">{successMessage}</p> : null}

        <Button type="submit" className="w-full" isLoading={isLoading} disabled={otpSeconds === 0 || isLocked}>
          ยืนยัน OTP
        </Button>
      </form>

      <div className="mt-4 space-y-3 text-center text-sm text-gray-500">
        <p>
          ยังไม่ได้รับ OTP?{" "}
          <button type="button" onClick={handleResend} disabled={isResending || resendSeconds > 0 || isLoading || isLocked} className="text-green-600 hover:underline disabled:text-gray-400 disabled:no-underline">
            {isResending ? "กำลังส่ง..." : resendSeconds > 0 ? `ส่งอีกครั้งได้ใน ${resendSeconds} วินาที` : "ส่งอีกครั้ง"}
          </button>
        </p>
        <p className="hidden">
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

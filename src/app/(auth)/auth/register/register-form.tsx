"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type VillageOption = {
  id: string;
  name: string;
  moo: string | null;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
};

type HouseResult = { houseId: string; houseNumber: string };
type Step = "FORM" | "OTP" | "SUCCESS";

type OtpState = {
  challengeId: string;
  maskedEmail: string;
  houseNumber: string;
  expiresAt: string;
  resendAvailableAt: string;
};

type SuccessState = {
  houseNumber: string;
  applicantName: string;
  contactPhone: string;
  maskedEmail: string;
};

async function responseError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error ?? fallback;
}

export function RegisterForm({ village }: { village: VillageOption }) {
  const [step, setStep] = useState<Step>("FORM");
  const [houseQuery, setHouseQuery] = useState("");
  const [houseResults, setHouseResults] = useState<HouseResult[]>([]);
  const [selectedHouse, setSelectedHouse] = useState<HouseResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [email, setEmail] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpState, setOtpState] = useState<OtpState | null>(null);
  const [successState, setSuccessState] = useState<SuccessState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const otpRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/auth/house-account-opening/status", {
      credentials: "include",
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as {
        status: string;
        houseNumber: string;
        applicantName: string;
        contactPhone: string;
        maskedEmail: string;
        challengeId: string | null;
        expiresAt: string | null;
        resendAvailableAt: string | null;
      };
      if (
        data.status === "PENDING_EMAIL_VERIFICATION"
        && data.challengeId
        && data.expiresAt
        && data.resendAvailableAt
      ) {
        setOtpState({
          challengeId: data.challengeId,
          maskedEmail: data.maskedEmail,
          houseNumber: data.houseNumber,
          expiresAt: data.expiresAt,
          resendAvailableAt: data.resendAvailableAt,
        });
        setStep("OTP");
      } else if (data.status === "PENDING_REVIEW") {
        setSuccessState({
          houseNumber: data.houseNumber,
          applicantName: data.applicantName,
          contactPhone: data.contactPhone,
          maskedEmail: data.maskedEmail,
        });
        setStep("SUCCESS");
      }
    }).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (step === "OTP") otpRef.current?.focus();
    if (step === "SUCCESS") headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedHouse && houseQuery === selectedHouse.houseNumber) return;
    setSelectedHouse(null);
    const trimmed = houseQuery.trim();
    if (!trimmed) {
      setHouseResults([]);
      setIsSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/auth/house-account-opening/houses?q=${encodeURIComponent(trimmed)}`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(await responseError(response, "ไม่สามารถค้นหาบ้านได้"));
        const data = await response.json() as { results: HouseResult[] };
        setHouseResults(data.results);
      } catch (searchError) {
        if (!controller.signal.aborted) {
          setHouseResults([]);
          setError(searchError instanceof Error ? searchError.message : "ไม่สามารถค้นหาบ้านได้");
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [houseQuery, selectedHouse]);

  const resendSeconds = otpState
    ? Math.max(0, Math.ceil((new Date(otpState.resendAvailableAt).getTime() - clock) / 1_000))
    : 0;

  async function startRequest(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!selectedHouse) {
      setError("กรุณาค้นหาและเลือกบ้านเลขที่จากรายการ");
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError("กรุณากรอกชื่อและนามสกุลผู้ขอ");
      return;
    }
    const phoneDigits = contactPhone.replace(/\D/g, "");
    if (!/^(?:0\d{8,9}|66\d{9})$/.test(phoneDigits)) {
      setError("กรุณากรอกเบอร์โทรสำหรับติดต่อให้ถูกต้อง");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("กรุณากรอกอีเมลให้ถูกต้อง");
      return;
    }
    if (!privacyConsent) {
      setError("กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนส่งคำขอ");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/house-account-opening/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          houseId: selectedHouse.houseId,
          applicantFirstName: firstName,
          applicantLastName: lastName,
          contactPhone,
          email,
          privacyConsent,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "ไม่สามารถเริ่มคำขอได้"));
      const data = await response.json() as OtpState;
      setOtpState(data);
      setOtpCode("");
      setStep("OTP");
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "ไม่สามารถเริ่มคำขอได้");
    } finally {
      setPending(false);
    }
  }

  async function verifyOtp(event: React.FormEvent) {
    event.preventDefault();
    if (!otpState || !/^\d{6}$/.test(otpCode)) {
      setError("กรุณากรอกรหัสยืนยัน 6 หลัก");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/house-account-opening/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ challengeId: otpState.challengeId, code: otpCode }),
      });
      if (!response.ok) throw new Error(await responseError(response, "ยืนยันอีเมลไม่สำเร็จ"));
      const data = await response.json() as SuccessState;
      setSuccessState(data);
      setOtpCode("");
      setStep("SUCCESS");
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "ยืนยันอีเมลไม่สำเร็จ");
      setOtpCode("");
      otpRef.current?.focus();
    } finally {
      setPending(false);
    }
  }

  async function resendOtp() {
    if (!otpState || resendSeconds > 0) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/house-account-opening/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ challengeId: otpState.challengeId }),
      });
      if (!response.ok) throw new Error(await responseError(response, "ส่งรหัสยืนยันอีกครั้งไม่สำเร็จ"));
      const data = await response.json() as OtpState;
      setOtpState((current) => current ? { ...current, ...data } : data);
      setClock(Date.now());
      setOtpCode("");
      otpRef.current?.focus();
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "ส่งรหัสยืนยันอีกครั้งไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }

  async function cancelRequest(preserveForm = false) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/house-account-opening/cancel", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await responseError(response, "ยกเลิกคำขอไม่สำเร็จ"));
      setOtpState(null);
      setSuccessState(null);
      setOtpCode("");
      if (!preserveForm) {
        setHouseQuery("");
        setSelectedHouse(null);
        setFirstName("");
        setLastName("");
        setContactPhone("");
        setEmail("");
        setPrivacyConsent(false);
      }
      setStep("FORM");
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "ยกเลิกคำขอไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }

  const cardClass = "mx-auto w-full max-w-2xl rounded-2xl border border-white/90 bg-white/95 p-4 shadow-xl shadow-emerald-950/10 ring-1 ring-emerald-100/80 backdrop-blur sm:p-8";

  if (step === "OTP" && otpState) {
    return <div className={cardClass}>
      <h1 className="text-xl font-bold text-gray-900">ยืนยันอีเมล</h1>
      <p className="mt-2 break-all text-sm leading-6 text-gray-600" aria-live="polite">เราได้ส่งรหัส 6 หลักไปยัง <strong>{otpState.maskedEmail}</strong></p>
      <p className="mt-1 text-sm text-gray-500">บ้านเลขที่ {otpState.houseNumber}</p>
      <form onSubmit={verifyOtp} className="mt-6 space-y-4">
        <Input ref={otpRef} id="house-opening-otp" label="รหัสยืนยัน" value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} className="text-center text-2xl tracking-[0.45em]" required />
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" isLoading={pending} className="w-full">ยืนยันอีเมล</Button>
      </form>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" disabled={pending || resendSeconds > 0} onClick={() => void resendOtp()}>{resendSeconds > 0 ? `ส่งรหัสอีกครั้งใน ${resendSeconds} วินาที` : "ส่งรหัสอีกครั้ง"}</Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => void cancelRequest(true)}>กลับไปแก้ไขข้อมูล</Button>
      </div>
      <button type="button" disabled={pending} onClick={() => void cancelRequest(false)} className="mt-4 w-full cursor-pointer text-sm text-red-700 underline disabled:opacity-50">ยกเลิกคำขอ</button>
    </div>;
  }

  if (step === "SUCCESS" && successState) {
    return <div className={cardClass}>
      <h1 ref={headingRef} tabIndex={-1} className="text-xl font-bold text-gray-900 outline-none">ส่งคำขอเรียบร้อยแล้ว</h1>
      <p className="mt-2 text-sm leading-6 text-gray-600">ระบบได้ส่งคำขอเปิดบัญชีบ้านให้ผู้ใหญ่บ้านตรวจสอบแล้ว</p>
      <dl className="mt-6 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-gray-50 px-4">
        <div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-sm text-gray-500">บ้านเลขที่</dt><dd className="min-w-0 break-all text-right font-medium text-gray-900">{successState.houseNumber}</dd></div>
        <div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-sm text-gray-500">ชื่อผู้ขอ</dt><dd className="min-w-0 break-words text-right font-medium text-gray-900">{successState.applicantName}</dd></div>
        <div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-sm text-gray-500">อีเมล</dt><dd className="min-w-0 break-all text-right font-medium text-gray-900">{successState.maskedEmail}</dd></div>
        <div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-sm text-gray-500">เบอร์โทรสำหรับติดต่อ</dt><dd className="min-w-0 break-all text-right font-medium text-gray-900">{successState.contactPhone}</dd></div>
        <div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-sm text-gray-500">สถานะ</dt><dd className="font-semibold text-amber-700">รอการตรวจสอบ</dd></div>
      </dl>
      {error ? <p role="alert" className="mt-4 text-sm text-red-600">{error}</p> : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/auth/login" className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">กลับไปหน้าเข้าสู่ระบบ</Link>
        <Button type="button" variant="dangerOutline" disabled={pending} isLoading={pending} onClick={() => void cancelRequest(false)}>ยกเลิกคำขอ</Button>
      </div>
    </div>;
  }

  return <div className={cardClass}>
    <h1 className="text-xl font-bold text-gray-900">ขอเปิดบัญชีบ้าน</h1>
    <p className="mt-2 text-sm leading-6 text-gray-600">สำหรับบ้านที่ยังไม่มีบัญชี กรุณาเลือกบ้านเลขที่และยืนยันอีเมลเพื่อส่งคำขอให้ผู้ใหญ่บ้านตรวจสอบ</p>
    <section className="mt-5 rounded-xl border border-green-100 bg-green-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-green-700">หมู่บ้าน</p>
      <p className="mt-1 font-semibold text-green-950">{village.name}{village.moo ? ` หมู่ ${village.moo}` : ""}</p>
      <p className="mt-1 text-xs text-green-800">{[village.subdistrict, village.district, village.province].filter(Boolean).join(" · ")}</p>
    </section>

    <form onSubmit={startRequest} className="mt-6 space-y-5">
      <div className="relative">
        <Input id="house-opening-house" label="บ้านเลขที่" role="combobox" value={houseQuery} onChange={(event) => { setHouseQuery(event.target.value.slice(0, 50)); setError(null); }} placeholder="เช่น 168/4" autoComplete="off" aria-autocomplete="list" aria-controls="house-search-results" aria-expanded={houseResults.length > 0} helperText="ค้นหาและเลือกบ้านที่มีอยู่ในทะเบียนหมู่บ้าน" required />
        <div id="house-search-results" role="listbox" className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-white">
          {isSearching ? <p className="px-3 py-3 text-sm text-gray-500" aria-live="polite">กำลังค้นหา...</p> : null}
          {!isSearching && houseQuery.trim() && houseResults.length === 0 && !selectedHouse ? <p className="px-3 py-3 text-sm text-gray-500" aria-live="polite">ไม่พบบ้านเลขที่นี้ กรุณาติดต่อผู้ใหญ่บ้าน</p> : null}
          {houseResults.map((house) => <button key={house.houseId} type="button" role="option" aria-selected={selectedHouse?.houseId === house.houseId} className="block w-full cursor-pointer break-all border-b border-gray-100 px-3 py-3 text-left text-sm last:border-b-0 hover:bg-green-50 focus:bg-green-50 focus:outline-none" onClick={() => { setSelectedHouse(house); setHouseQuery(house.houseNumber); setHouseResults([]); setError(null); }}>บ้านเลขที่ {house.houseNumber}</button>)}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="house-opening-first-name" name="givenName" label="ชื่อผู้ขอ" value={firstName} onChange={(event) => setFirstName(event.target.value.slice(0, 100))} autoComplete="given-name" maxLength={100} required />
        <Input id="house-opening-last-name" name="familyName" label="นามสกุลผู้ขอ" value={lastName} onChange={(event) => setLastName(event.target.value.slice(0, 100))} autoComplete="family-name" maxLength={100} required />
      </div>
      <Input id="house-opening-phone" name="contactPhone" label="เบอร์โทรสำหรับติดต่อ" type="tel" inputMode="tel" autoComplete="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value.slice(0, 20))} placeholder="0812345678" helperText="ใช้สำหรับให้ผู้ใหญ่บ้านติดต่อเพิ่มเติม ไม่ใช้เข้าสู่ระบบและไม่มี SMS OTP" maxLength={20} required />
      <Input id="house-opening-email" name="email" label="อีเมลสำหรับเข้าสู่ระบบ" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value.slice(0, 320))} placeholder="name@example.com" maxLength={320} required />
      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
        <input type="checkbox" checked={privacyConsent} onChange={(event) => setPrivacyConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-green-600" required />
        <span>ฉันยอมรับ <Link href="/consent" target="_blank" className="font-medium text-green-700 underline">นโยบายความเป็นส่วนตัว</Link> สำหรับการส่งคำขอเปิดบัญชีบ้าน</span>
      </label>
      {error ? <p role="alert" aria-live="polite" className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" className="w-full" isLoading={pending}>ส่งรหัสยืนยันอีเมล</Button>
    </form>
    <p className="mt-6 text-center text-sm text-gray-600">มีบัญชีอยู่แล้ว? <Link href="/auth/login" className="font-medium text-green-700 underline">เข้าสู่ระบบ</Link></p>
  </div>;
}

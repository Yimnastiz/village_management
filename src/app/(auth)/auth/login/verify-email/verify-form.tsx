"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type FlowState = { flowId: string; maskedEmail: string; expiresAt: string; resendAvailableAt: string };

function secondsUntil(value: string | undefined): number {
  return value ? Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 1_000)) : 0;
}

export function AccountLoginVerifyForm() {
  const [flow, setFlow] = useState<FlowState | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);
  const router = useRouter();
  const { success, error: showError } = useToast();

  useEffect(() => {
    let active = true;
    fetch("/api/auth/account-login/status", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("ไม่พบขั้นตอนเข้าสู่ระบบ กรุณาเริ่มใหม่");
        return response.json() as Promise<FlowState>;
      })
      .then((state) => { if (active) setFlow(state); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "ไม่พบขั้นตอนเข้าสู่ระบบ"); });
    const timer = window.setInterval(() => setNowTick(Date.now()), 1_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const resendSeconds = secondsUntil(flow?.resendAvailableAt);
  const expired = flow ? secondsUntil(flow.expiresAt) === 0 : false;
  void nowTick;

  const updateCode = (nextCode: string, focusIndex?: number) => {
    const digits = nextCode.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (focusIndex !== undefined && digits.length < 6) codeRefs.current[focusIndex]?.focus();
  };

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const digits = code.split("").slice(0, 6);
    digits[index] = digit;
    const nextCode = digits.join("").slice(0, 6);
    setCode(nextCode);
    if (digit && index < 5) codeRefs.current[index + 1]?.focus();
  };

  const handleDigitKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      event.preventDefault();
      const digits = code.split("");
      digits[index - 1] = "";
      setCode(digits.join(""));
      codeRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      codeRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < 5) {
      event.preventDefault();
      codeRefs.current[index + 1]?.focus();
    }
  };

  const handleCodePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    updateCode(event.clipboardData.getData("text"));
    const pastedLength = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).length;
    codeRefs.current[Math.min(pastedLength, 5)]?.focus();
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!flow || !/^\d{6}$/.test(code)) { setError("กรุณากรอกรหัสยืนยัน 6 หลัก"); return; }
    setIsLoading(true); setError(null);
    try {
      const response = await fetch("/api/auth/account-login/verify", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ flowId: flow.flowId, code }) });
      const data = await response.json().catch(() => null) as { landingPath?: string; message?: string } | null;
      if (!response.ok) throw new Error(data?.message || "รหัสยืนยันไม่ถูกต้องหรือหมดอายุแล้ว");
      const sessionCheck = await fetch("/api/auth/post-login-route", { credentials: "include", cache: "no-store" });
      if (!sessionCheck.ok) throw new Error("ระบบไม่สามารถยืนยันเซสชันเข้าสู่ระบบได้");
      const route = await sessionCheck.json().catch(() => null) as { landingPath?: string } | null;
      success("เข้าสู่ระบบสำเร็จ", "กำลังไปยังหน้าหลักของคุณ");
      router.replace(route?.landingPath || data?.landingPath || "/");
      router.refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "ไม่สามารถเข้าสู่ระบบได้";
      setError(message); showError("เข้าสู่ระบบไม่สำเร็จ", message);
    } finally { setIsLoading(false); }
  };

  const resend = async () => {
    if (!flow || resendSeconds > 0) return;
    setIsLoading(true); setError(null);
    try {
      const response = await fetch("/api/auth/account-login/resend", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ flowId: flow.flowId }) });
      const data = await response.json().catch(() => null) as FlowState & { error?: string };
      if (!response.ok) throw new Error(data.error || "ไม่สามารถส่งรหัสใหม่ได้");
      setFlow(data); setCode(""); codeRefs.current[0]?.focus();
      success("ส่งรหัสยืนยันอีกครั้งแล้ว", "กรุณาตรวจสอบอีเมล");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "ไม่สามารถส่งรหัสใหม่ได้"); } finally { setIsLoading(false); }
  };

  const cancel = async () => {
    if (flow) await fetch("/api/auth/account-login/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ flowId: flow.flowId }) }).catch(() => undefined);
    router.replace("/auth/login");
  };

  return <div className="mx-auto max-w-md rounded-2xl border border-white/90 bg-white/90 p-6 shadow-xl shadow-emerald-950/10 ring-1 ring-emerald-100/80 backdrop-blur sm:p-8">
    <h2 className="text-xl font-bold text-gray-900">ยืนยันอีเมล</h2>
    <p className="mt-2 text-sm leading-6 text-gray-600">กรอกรหัสยืนยันที่ส่งไปยังอีเมลของคุณ{flow?.maskedEmail ? <> <span className="font-semibold text-gray-900">{flow.maskedEmail}</span></> : null}</p>
    <form onSubmit={verify} className="mt-6 space-y-4">
      <fieldset disabled={!flow || expired}>
        <legend className="mb-2 block text-sm font-medium text-gray-700">รหัสยืนยัน <span className="text-red-600">*</span></legend>
        <div className="grid grid-cols-6 gap-2 sm:gap-3" onPaste={handleCodePaste}>
          {Array.from({ length: 6 }, (_, index) => <input key={index} ref={(element) => { codeRefs.current[index] = element; }} aria-label={`รหัสยืนยันหลักที่ ${index + 1}`} value={code[index] || ""} onChange={(event) => handleDigitChange(index, event.target.value)} onKeyDown={(event) => handleDigitKeyDown(index, event)} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} pattern="[0-9]" maxLength={1} className="h-14 w-full rounded-xl border border-gray-300 bg-white text-center text-2xl font-semibold tracking-wide text-gray-900 shadow-sm outline-none transition placeholder:text-gray-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400" />)}
        </div>
      </fieldset>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      {expired ? <p className="text-sm text-amber-700">ขั้นตอนเข้าสู่ระบบหมดอายุแล้ว กรุณาเริ่มใหม่</p> : null}
      <Button type="submit" className="w-full" isLoading={isLoading} disabled={!flow || expired}>ยืนยันและเข้าสู่ระบบ</Button>
    </form>
    <div className="mt-4 flex flex-col gap-2 text-center text-sm"><button type="button" onClick={resend} disabled={!flow || resendSeconds > 0 || isLoading} className="min-h-11 font-medium text-green-700 disabled:text-gray-400">{resendSeconds > 0 ? `ส่งรหัสอีกครั้งใน ${resendSeconds} วินาที` : "ส่งรหัสอีกครั้ง"}</button><button type="button" onClick={cancel} className="min-h-11 text-gray-600 hover:text-gray-900">เปลี่ยนอีเมล</button></div>
  </div>;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Mail, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { MAX_HOUSE_ACCOUNT_EMAILS } from "@/lib/house-account-email-policy";

type EmailRow = {
  id: string;
  email: string;
  isCanonical: boolean;
  isCurrentSession: boolean;
};

type FlowResponse = {
  error?: string;
  maskedEmail?: string;
  expiresAt?: string;
  resendAvailableAt?: string;
};

export function HouseAccountEmailManager({ emails }: { emails: EmailRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"EMAIL" | "OTP">("EMAIL");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [resendAvailableAt, setResendAvailableAt] = useState<Date | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "OTP") codeRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!resendAvailableAt) return;
    const update = () => setSeconds(Math.max(0, Math.ceil((resendAvailableAt.getTime() - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [resendAvailableAt]);

  function reset() {
    setOpen(false); setStep("EMAIL"); setEmail(""); setCode(""); setMaskedEmail(""); setResendAvailableAt(null);
  }

  async function closeFlow() {
    if (step === "OTP") await fetch("/api/auth/house-account-emails/cancel", { method: "POST" }).catch(() => undefined);
    reset();
  }

  async function start(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    const response = await fetch("/api/auth/house-account-emails/start", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
    });
    const body = (await response.json().catch(() => null)) as FlowResponse | null;
    setBusy(false);
    if (!response.ok || !body?.expiresAt || !body.resendAvailableAt) {
      toast.error(body?.error ?? "ไม่สามารถส่งรหัสยืนยันได้"); return;
    }
    setMaskedEmail(body.maskedEmail ?? email); setResendAvailableAt(new Date(body.resendAvailableAt)); setStep("OTP");
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    const response = await fetch("/api/auth/house-account-emails/verify", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
    });
    const body = (await response.json().catch(() => null)) as FlowResponse | null;
    setBusy(false);
    if (!response.ok) { toast.error(body?.error ?? "ไม่สามารถยืนยันอีเมลได้"); return; }
    reset(); toast.success("เพิ่มอีเมลสำหรับเข้าสู่ระบบแล้ว"); router.refresh();
  }

  async function resend() {
    setBusy(true);
    const response = await fetch("/api/auth/house-account-emails/resend", { method: "POST" });
    const body = (await response.json().catch(() => null)) as FlowResponse | null;
    setBusy(false);
    if (!response.ok || !body?.resendAvailableAt) { toast.error(body?.error ?? "ไม่สามารถส่งรหัสใหม่ได้"); return; }
    setResendAvailableAt(new Date(body.resendAvailableAt)); toast.success("ส่งรหัสยืนยันใหม่แล้ว");
  }

  async function remove(row: EmailRow) {
    if (!window.confirm(`ยืนยันนำ ${row.email} ออกจากบัญชีบ้านหรือไม่`)) return;
    setRemovingId(row.id);
    const response = await fetch(`/api/auth/house-account-emails/${encodeURIComponent(row.id)}`, { method: "DELETE" });
    const body = (await response.json().catch(() => null)) as { error?: string; currentSessionRevoked?: boolean } | null;
    setRemovingId(null);
    if (!response.ok) { toast.error(body?.error ?? "ไม่สามารถนำอีเมลออกได้"); return; }
    if (body?.currentSessionRevoked) {
      window.location.assign("/auth/login?emailRemoved=success"); return;
    }
    toast.success("นำอีเมลออกแล้ว"); router.refresh();
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="flex items-center gap-2 font-semibold text-gray-900"><Mail className="h-5 w-5 text-green-700" aria-hidden="true" />อีเมลสำหรับเข้าสู่ระบบ</h2><p className="mt-1 text-sm text-gray-600">อีเมลที่ยืนยันแล้วสามารถใช้เข้าสู่บัญชีบ้านนี้ได้</p></div>
        <Button type="button" className="min-h-11 shrink-0" disabled={emails.length >= MAX_HOUSE_ACCOUNT_EMAILS} onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" aria-hidden="true" />เพิ่มอีเมล</Button>
      </div>
      <ul className="mt-5 divide-y divide-gray-100 border-y border-gray-100">
        {emails.map((row) => (
          <li key={row.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><p className="break-all font-medium text-gray-900">{row.email}</p><div className="mt-2 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-green-50 px-2 py-1 text-green-700"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />ยืนยันแล้ว</span>{row.isCanonical ? <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">อีเมลหลัก</span> : null}{row.isCurrentSession ? <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800">กำลังใช้ในเซสชันนี้</span> : null}</div></div>
            <Button type="button" variant="dangerOutline" className="min-h-11 self-start sm:self-auto" disabled={emails.length <= 1} isLoading={removingId === row.id} onClick={() => remove(row)}><Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />นำอีเมลออก</Button>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-gray-500">เพิ่มได้สูงสุด {MAX_HOUSE_ACCOUNT_EMAILS} อีเมล และต้องเหลืออีเมลที่ใช้งานอย่างน้อย 1 อีเมล</p>
      <p className="mt-2 text-sm text-gray-500">หากไม่สามารถเข้าถึงอีเมลที่เชื่อมกับบัญชีบ้านได้ทั้งหมด กรุณาติดต่อผู้ใหญ่บ้าน</p>

      <Dialog open={open} onClose={closeFlow} title="เพิ่มอีเมลสำหรับเข้าสู่ระบบ" description={step === "EMAIL" ? "อีเมลใหม่ต้องผ่านการยืนยันก่อนจึงจะใช้เข้าสู่ระบบได้" : `กรอกรหัส 6 หลักที่ส่งไปยัง ${maskedEmail}`} closeOnBackdrop={!busy} closeOnEscape={!busy}>
        {step === "EMAIL" ? (
          <form className="space-y-4" onSubmit={start}><div><label htmlFor="new-house-email" className="mb-1.5 block text-sm font-medium text-gray-700">อีเมลใหม่</label><input id="new-house-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20" /></div><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={closeFlow}>ยกเลิก</Button><Button type="submit" className="min-h-11" isLoading={busy}>ส่งรหัสยืนยัน</Button></div></form>
        ) : (
          <form className="space-y-4" onSubmit={verify}><div><label htmlFor="new-house-email-otp" className="mb-1.5 block text-sm font-medium text-gray-700">รหัสยืนยัน</label><input ref={codeRef} id="new-house-email-otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="min-h-12 w-full rounded-lg border border-gray-300 px-3 text-center text-xl tracking-[0.35em] focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20" /></div><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><button type="button" disabled={busy || seconds > 0} onClick={resend} className="min-h-11 rounded-lg px-3 text-sm font-medium text-green-700 disabled:text-gray-400">{seconds > 0 ? `ส่งใหม่ได้ใน ${seconds} วินาที` : "ส่งรหัสอีกครั้ง"}</button><div className="flex flex-col-reverse gap-2 sm:flex-row"><Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={closeFlow}>ยกเลิก</Button><Button type="submit" className="min-h-11" disabled={code.length !== 6} isLoading={busy}>ยืนยันอีเมล</Button></div></div></form>
        )}
      </Dialog>
    </section>
  );
}

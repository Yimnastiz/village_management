"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AccountDeletionCard() {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sendOtp() {
    setBusy(true); setMessage(null);
    const response = await fetch("/api/auth/account-deletion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "SEND_OTP" }) });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!response.ok) return setMessage(body?.error ?? "ไม่สามารถส่ง OTP ได้");
    setSent(true); setMessage("ส่ง OTP สำหรับยืนยันแล้ว");
  }

  async function requestDeletion() {
    if (!accepted || confirmation !== "ลบบัญชี" || !/^\d{6}$/.test(code)) return setMessage("กรุณากรอกข้อมูลยืนยันให้ครบ");
    setBusy(true); setMessage(null);
    const response = await fetch("/api/auth/account-deletion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "REQUEST_DELETION", code, confirmation, accepted }) });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) { setBusy(false); return setMessage(body?.error ?? "ไม่สามารถปิดบัญชีได้"); }
    window.location.replace("/auth/login?accountDeletion=pending");
  }

  return (
    <section className="rounded-xl border border-red-200 bg-white p-4 sm:p-6">
      <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" /><div><h2 className="font-semibold text-red-700">ปิดหรือลบบัญชี</h2><p className="mt-1 text-sm text-gray-600">Session ทุกอุปกรณ์จะถูกเพิกถอน คำขอผูกบ้านที่รออยู่จะถูกยกเลิก และหลังระยะผ่อนผัน 7 วันจะย้อนกลับไม่ได้ ข้อมูลทะเบียน Person, House และประวัติที่จำเป็นจะยังคงอยู่</p></div></div>
      {!sent ? <Button type="button" variant="danger" className="mt-4" isLoading={busy} onClick={sendOtp}>ส่ง OTP เพื่อดำเนินการ</Button> : (
        <div className="mt-4 space-y-3">
          <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="OTP 6 หลัก" className="w-full rounded-lg border border-gray-300 px-3 py-2" />
          <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="พิมพ์คำว่า ลบบัญชี" className="w-full rounded-lg border border-gray-300 px-3 py-2" />
          <label className="flex items-start gap-2 text-sm text-gray-700"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1" /><span>ฉันเข้าใจผลกระทบและยืนยันคำขอปิดบัญชี</span></label>
          <Button type="button" variant="danger" isLoading={busy} onClick={requestDeletion}>ยืนยันปิดบัญชี</Button>
        </div>
      )}
      {message ? <p className="mt-3 text-sm text-red-700">{message}</p> : null}
    </section>
  );
}

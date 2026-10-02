"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { sanitizeInternalCallbackUrl } from "@/lib/callback-url";

function LoginContent() {
  const [email, setEmail] = useState(""); const [error, setError] = useState<string | null>(null); const [isLoading, setIsLoading] = useState(false);
  const router = useRouter(); const searchParams = useSearchParams(); const { success, error: showError } = useToast();
  const callbackUrl = sanitizeInternalCallbackUrl(searchParams.get("callbackUrl"));
  const registerHref = callbackUrl ? `/auth/register?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/auth/register";
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null); const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) { setError("กรุณากรอกอีเมลให้ถูกต้อง"); return; }
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/account-login/start", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ email: normalizedEmail, callbackUrl }) });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "ไม่สามารถส่งรหัสยืนยันได้");
      success("ส่งรหัสยืนยันแล้ว", "กรุณาตรวจสอบอีเมลของคุณ"); router.push("/auth/login/verify-email");
    } catch (caught) { const message = caught instanceof Error ? caught.message : "ไม่สามารถส่งรหัสยืนยันได้"; setError(message); showError("ส่งรหัสยืนยันไม่สำเร็จ", message); }
    finally { setIsLoading(false); }
  };
  return <div className="mx-auto max-w-md rounded-2xl border border-white/90 bg-white/90 p-6 shadow-xl shadow-emerald-950/10 ring-1 ring-emerald-100/80 backdrop-blur sm:p-8">
    <h2 className="text-xl font-bold text-gray-900">เข้าสู่ระบบ</h2><p className="mt-2 text-sm text-gray-500">กรอกอีเมลที่ใช้กับบัญชีของคุณ</p>
    {searchParams.get("registered") === "1" ? <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">ส่งคำขอเปิดบัญชีบ้านแล้ว กรุณารอการตรวจสอบ เมื่ออนุมัติแล้วจึงเข้าสู่ระบบด้วยอีเมลได้</div> : null}
    {searchParams.get("deletionPending") === "1" ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">บัญชีอยู่ระหว่างระยะผ่อนผันการปิด 7 วัน</div> : null}
    <form onSubmit={submit} className="mt-5 space-y-4"><Input id="login-email" name="email" label="อีเมล" type="email" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={320} required />{error ? <p className="text-sm text-red-600">{error}</p> : null}<Button type="submit" className="w-full" isLoading={isLoading}>ส่งรหัสยืนยัน</Button></form>
    <div className="mt-6 text-center text-sm text-gray-600">บ้านของคุณยังไม่มีบัญชี?{" "}<Link href={registerHref} className="font-medium text-green-600 hover:underline">ขอเปิดบัญชีบ้าน</Link></div>
  </div>;
}
export function LoginForm() { return <Suspense fallback={<div>กำลังโหลด...</div>}><LoginContent /></Suspense>; }

import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getFirstSuperAdminBootstrapState } from "@/lib/first-superadmin";
import { FirstSuperAdminSetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function FirstSuperAdminSetupPage() {
  const state = await getFirstSuperAdminBootstrapState();
  if (state.hasSuperAdmin) notFound();

  return <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_12%_18%,rgba(45,212,191,0.18),transparent_28%),radial-gradient(circle_at_88%_82%,rgba(96,165,250,0.16),transparent_30%),linear-gradient(135deg,#ecfdf5_0%,#f8fafc_48%,#eff6ff_100%)] px-4 py-10 sm:px-6"><section className="w-full max-w-md"><div className="rounded-2xl border border-white/90 bg-white/95 p-6 shadow-xl shadow-emerald-950/10 ring-1 ring-emerald-100 sm:p-8"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><ShieldCheck className="h-6 w-6" /></div><h1 className="mt-4 text-2xl font-bold text-slate-900">ตั้งค่า Super Admin คนแรก</h1><p className="mt-2 text-sm leading-6 text-slate-600">ใช้หน้านี้เฉพาะตอนติดตั้งระบบครั้งแรกเท่านั้น หลังจากสร้าง Super Admin สำเร็จ ระบบจะปิดหน้านี้อัตโนมัติ</p>{!state.isSecretConfigured || !state.isSafeForProduction ? <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">ผู้ดูแลระบบต้องตั้งค่า <code>SUPERADMIN_BOOTSTRAP_SECRET</code> ในไฟล์ .env ก่อน</p> : <FirstSuperAdminSetupForm />}</div></section></main>;
}

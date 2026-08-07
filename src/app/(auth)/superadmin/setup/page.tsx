import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { FirstSuperAdminSetupForm } from "./setup-form";
import { getFirstSuperAdminBootstrapState } from "@/lib/first-superadmin";

export const dynamic = "force-dynamic";

export default async function FirstSuperAdminSetupPage() {
  const state = await getFirstSuperAdminBootstrapState();
  if (state.hasSuperAdmin) {
    return <main className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xl shadow-slate-950/10 sm:p-8"><ShieldCheck className="mx-auto h-10 w-10 text-emerald-600" /><h2 className="mt-4 text-xl font-bold text-slate-900">ตั้งค่าเสร็จแล้ว</h2><p className="mt-2 text-sm text-slate-600">ระบบมี Super Admin แล้ว ไม่สามารถใช้หน้า setup นี้ได้อีก</p><Link href="/superadmin/login" className="mt-6 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">ไปหน้าเข้าสู่ระบบ</Link></main>;
  }
  if (!state.isSecretConfigured || !state.isSafeForProduction) {
    return <main className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-xl shadow-amber-950/10 sm:p-8"><ShieldCheck className="mx-auto h-10 w-10 text-amber-600" /><h2 className="mt-4 text-xl font-bold text-slate-900">ยังไม่พร้อมตั้งค่า</h2><p className="mt-2 text-sm text-slate-600">ผู้ดูแลระบบต้องตั้งค่า <code>SUPERADMIN_BOOTSTRAP_SECRET</code> ในไฟล์ .env ก่อน</p></main>;
  }
  return <main className="mx-auto max-w-md rounded-2xl border border-white/90 bg-white/95 p-6 shadow-xl shadow-emerald-950/10 ring-1 ring-emerald-100 sm:p-8"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><ShieldCheck className="h-6 w-6" /></div><h2 className="mt-4 text-2xl font-bold text-slate-900">ตั้งค่า Super Admin คนแรก</h2><p className="mt-2 text-sm leading-6 text-slate-600">ใช้หน้านี้เฉพาะตอนติดตั้งระบบครั้งแรกเท่านั้น หลังจากสร้างสำเร็จ ระบบจะปิดหน้านี้อัตโนมัติ</p><FirstSuperAdminSetupForm /></main>;
}

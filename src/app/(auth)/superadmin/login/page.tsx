import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getAuthenticatedAccessRedirectPath, getSessionContextFromServerCookies } from "@/lib/access-control";
import { getFirstSuperAdminBootstrapState } from "@/lib/first-superadmin";

export const dynamic = "force-dynamic";

export default async function SuperAdminLoginPage() {
  const session = await getSessionContextFromServerCookies();
  if (session) redirect(await getAuthenticatedAccessRedirectPath(session));

  const state = await getFirstSuperAdminBootstrapState();
  if (state.hasSuperAdmin) redirect("/auth/login?callbackUrl=/superadmin/dashboard");
  return <main className="mx-auto max-w-md rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-xl shadow-emerald-950/10 sm:p-8"><ShieldCheck className="mx-auto h-11 w-11 text-emerald-600" /><h2 className="mt-4 text-2xl font-bold text-slate-900">ระบบยังไม่มี Super Admin</h2><p className="mt-2 text-sm leading-6 text-slate-600">ตั้งค่าผู้ดูแลสูงสุดคนแรกด้วยรหัสติดตั้งจากไฟล์ .env</p><Link href="/superadmin/setup" className="mt-6 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">ตั้งค่า Super Admin คนแรก</Link></main>;
}

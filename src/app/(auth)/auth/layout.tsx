import Link from "next/link";
import { House } from "lucide-react";
import { ShieldCheck } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-x-hidden bg-[radial-gradient(circle_at_12%_18%,rgba(45,212,191,0.18),transparent_28%),radial-gradient(circle_at_88%_82%,rgba(96,165,250,0.16),transparent_30%),linear-gradient(135deg,#ecfdf5_0%,#f8fafc_48%,#eff6ff_100%)] p-4 sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-20 top-20 h-56 w-56 rounded-full border border-emerald-200/60 bg-white/20" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-12 h-72 w-72 rounded-full border border-sky-200/60 bg-white/20" />
      <div className="relative w-full max-w-3xl">
        <div className="mb-5 rounded-2xl border border-white/80 bg-white/75 px-5 py-4 shadow-lg shadow-emerald-950/5 backdrop-blur sm:mb-6 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-sm"><House className="h-5 w-5" /></span>
              <div>
              <h1 className="text-2xl font-bold text-green-800">ระบบหมู่บ้านอัจฉริยะ</h1>
              <p className="mt-1 text-sm text-emerald-700">Smart Village Management System</p>
              </div>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:text-emerald-950"
            >
              <ShieldCheck className="h-4 w-4" />
              กลับสู่หน้าเว็บไซต์สาธารณะ
            </Link>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

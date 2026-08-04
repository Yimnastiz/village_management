import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-100/70 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-3xl">
        <div className="mb-5 rounded-2xl border border-green-200/80 bg-white/85 px-5 py-4 shadow-sm backdrop-blur sm:mb-6 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-green-800">ระบบหมู่บ้านอัจฉริยะ</h1>
              <p className="text-green-600 text-sm mt-1">Smart Village Management System</p>
            </div>
            <Link
              href="/"
              className="text-sm font-medium text-green-700 hover:text-green-900"
            >
              กลับสู่หน้าเว็บไซต์สาธารณะ
            </Link>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

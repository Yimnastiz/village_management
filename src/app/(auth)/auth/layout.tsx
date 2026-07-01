import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 rounded-3xl border border-green-200 bg-white/70 px-5 py-4 shadow-sm">
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

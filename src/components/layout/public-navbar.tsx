import Link from "next/link";
import { Home } from "lucide-react";

export function PublicNavbar() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-green-700 text-lg">
            <Home className="h-5 w-5" />
            <span>ระบบหมู่บ้านอัจฉริยะ</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <Link href="/info" className="hover:text-green-700">ข้อมูลโครงการ</Link>
            <Link href="/faq" className="hover:text-green-700">คำถามพบบ่อย</Link>
            <Link href="/feedback" className="hover:text-green-700">เสนอแนะ</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="px-4 py-2 text-sm text-green-700 border border-green-700 rounded-lg hover:bg-green-50"
            >
              เข้าสู่ระบบ
            </Link>
            <Link
              href="/auth/register"
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              สมัครสมาชิก
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

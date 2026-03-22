import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="bg-gray-800 text-gray-300 py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-white font-semibold mb-3">ระบบหมู่บ้านอัจฉริยะ</h3>
            <p className="text-sm">ระบบบริหารจัดการหมู่บ้านสำหรับชุมชนไทย</p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-3">ลิงก์ด่วน</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/info" className="hover:text-white">ข้อมูลโครงการ</Link></li>
              <li><Link href="/faq" className="hover:text-white">คำถามพบบ่อย</Link></li>
              <li><Link href="/feedback" className="hover:text-white">เสนอแนะ/ร้องเรียน</Link></li>
              <li><Link href="/consent" className="hover:text-white">นโยบายความเป็นส่วนตัว</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-3">ติดต่อ</h3>
            <p className="text-sm">support@village.go.th</p>
          </div>
        </div>
        <div className="border-t border-gray-700 mt-8 pt-4 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} ระบบหมู่บ้านอัจฉริยะ. สงวนลิขสิทธิ์
        </div>
      </div>
    </footer>
  );
}

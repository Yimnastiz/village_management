import { AlertCircle, Calendar, Newspaper, Bell } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import Link from "next/link";

export default function ResidentDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">สวัสดี, ลูกบ้าน!</h1>
        <p className="text-gray-500 text-sm mt-1">ภาพรวมข้อมูลของคุณ</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="ปัญหาที่แจ้ง" value="3" icon={AlertCircle} color="blue" trend="2 กำลังดำเนินการ" />
        <StatCard title="นัดหมาย" value="1" icon={Calendar} color="green" trend="นัดหน้า: 15 มี.ค." />
        <StatCard title="ข่าวที่ยังไม่ได้อ่าน" value="5" icon={Newspaper} color="yellow" />
        <StatCard title="การแจ้งเตือน" value="2" icon={Bell} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">ข่าวล่าสุด</h2>
          <div className="space-y-3">
            {["ประกาศตรวจน้ำประปา วันที่ 20 มี.ค.", "กิจกรรมทำความสะอาดหมู่บ้าน", "การประชุมคณะกรรมการ"].map((news, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-sm text-gray-700">{news}</span>
              </div>
            ))}
          </div>
          <Link href="/resident/news" className="text-sm text-green-600 hover:underline mt-3 block">
            ดูทั้งหมด →
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">ปัญหาล่าสุด</h2>
          <div className="space-y-3">
            {[
              { title: "ท่อน้ำรั่วหน้าบ้าน", status: "กำลังดำเนินการ", color: "bg-blue-100 text-blue-700" },
              { title: "ไฟถนนดับ", status: "แก้ไขแล้ว", color: "bg-green-100 text-green-700" },
            ].map((issue, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm text-gray-700">{issue.title}</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${issue.color}`}>
                  {issue.status}
                </span>
              </div>
            ))}
          </div>
          <Link href="/resident/issues" className="text-sm text-green-600 hover:underline mt-3 block">
            ดูทั้งหมด →
          </Link>
        </div>
      </div>
    </div>
  );
}

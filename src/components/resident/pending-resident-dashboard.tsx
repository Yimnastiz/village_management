import Link from "next/link";
import { ArrowRight, CalendarDays, FileDown, FileSearch, Images, MapPin, Newspaper, Phone } from "lucide-react";
import type { PendingResidentContext } from "@/lib/pending-resident-access";

const links = [
  ["ข่าวสาร", "ข่าวและประกาศของหมู่บ้าน", "/resident/news", Newspaper],
  ["ปฏิทิน", "กิจกรรมและกำหนดการ", "/resident/calendar", CalendarDays],
  ["แกลเลอรี", "ภาพกิจกรรมของหมู่บ้าน", "/resident/gallery", Images],
  ["สถานที่", "สถานที่สำคัญในหมู่บ้าน", "/resident/places", MapPin],
  ["เอกสาร", "เอกสารและดาวน์โหลด", "/resident/downloads", FileDown],
  ["งบประมาณ", "ข้อมูลสาธารณะของหมู่บ้าน", "/resident/transparency", FileSearch],
  ["ผู้ติดต่อ", "ช่องทางติดต่อหมู่บ้าน", "/resident/contacts", Phone],
] as const;

export function PendingResidentDashboard({ context }: { context: PendingResidentContext }) {
  return <div className="mx-auto w-full max-w-5xl space-y-6">
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
      <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">รอการอนุมัติ</span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-gray-950 sm:text-2xl">คำขอเปิดบัญชีประจำบ้านกำลังอยู่ระหว่างการตรวจสอบ</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">ผู้ใหญ่บ้านกำลังตรวจสอบคำขอของคุณ ระหว่างนี้คุณสามารถเรียกดูข้อมูลสาธารณะของหมู่บ้านได้</p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3"><dt className="text-xs text-gray-500">บ้านเลขที่</dt><dd className="mt-1 font-semibold text-gray-900">{context.houseNumber}</dd></div>
        <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3"><dt className="text-xs text-gray-500">อีเมลที่ยืนยันแล้ว</dt><dd className="mt-1 break-all font-semibold text-gray-900">{context.verifiedEmail}</dd></div>
      </dl>
      <ol className="mt-7 grid gap-3 border-t border-gray-100 pt-6 sm:grid-cols-3">
        <li className="flex items-center gap-3 text-sm text-green-700"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100 font-semibold">✓</span><span>ยืนยันอีเมลแล้ว</span></li>
        <li className="flex items-center gap-3 text-sm font-semibold text-amber-700"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100">2</span><span>รอการตรวจสอบ</span></li>
        <li className="flex items-center gap-3 text-sm text-gray-400"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-200">3</span><span>เปิดใช้งานบัญชี</span></li>
      </ol>
    </section>
    <section>
      <h2 className="text-lg font-semibold text-gray-950">ข้อมูลหมู่บ้าน</h2>
      <p className="mt-1 text-sm text-gray-600">สามารถเรียกดูข้อมูลเหล่านี้ได้ระหว่างรอการอนุมัติ</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map(([label, description, href, Icon]) => <Link key={href} href={href} className="group flex min-w-0 items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-green-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700"><Icon className="h-5 w-5" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-gray-900">{label}</span><span className="mt-0.5 block truncate text-xs text-gray-500">{description}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-green-700" aria-hidden="true" /></Link>)}
      </div>
    </section>
    <aside className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5"><h2 className="text-sm font-semibold text-gray-900">บริการสำหรับสมาชิก</h2><p className="mt-1 text-sm leading-6 text-gray-600">การแจ้งปัญหา การนัดหมาย ข้อมูลครัวเรือน และบริการอื่น ๆ จะเปิดใช้งานหลังผู้ใหญ่บ้านอนุมัติคำขอ</p></aside>
  </div>;
}

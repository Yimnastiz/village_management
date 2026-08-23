"use client";
import Link from "next/link";
import { ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResidentFilterDropdown, ResidentMultiFilterDropdown, ResidentPageToolbar } from "@/components/resident/resident-page-toolbar";
import { RequestAppointmentButton } from "./request-appointment-button";

type Status = "PENDING_APPROVAL" | "TIME_SUGGESTED" | "APPROVED" | "REJECTED" | "CANCELLED" | "COMPLETED";
type Props = { keyword: string; statuses: Status[]; period: "all" | "upcoming" | "past"; sort: "newest" | "oldest"; suggestions: string[] };
function href(statuses: Status[], period: Props["period"], sort: Props["sort"], keyword: string) { const params = new URLSearchParams(); if (statuses.length) params.set("status", statuses.join(",")); if (period !== "all") params.set("period", period); if (sort !== "newest") params.set("sort", sort); if (keyword.trim()) params.set("q", keyword.trim()); return params.size ? `/resident/appointments?${params}` : "/resident/appointments"; }
export function ResidentAppointmentsToolbar({ keyword, statuses, period, sort, suggestions }: Props) {
  const active = new Set(statuses); const toggle = (status: Status) => href(active.has(status) ? statuses.filter((item) => item !== status) : [...statuses, status], period, sort, keyword); const count = statuses.length + Number(period !== "all");
  const statusOptions: Array<[Status, string]> = [["PENDING_APPROVAL", "รอตอบกลับ"], ["TIME_SUGGESTED", "รอยืนยันเวลา"], ["APPROVED", "ยืนยันแล้ว"], ["REJECTED", "ปฏิเสธ"], ["CANCELLED", "ยกเลิก"], ["COMPLETED", "เสร็จสิ้น"]];
  return <ResidentPageToolbar namespace="resident-appointments" title="นัดหมาย" description="ติดตามนัดหมายของคุณ" registerHeader search={{ keyword, placeholder: "ค้นหาหัวข้อนัดหมาย", label: "ค้นหานัดหมาย", suggestions }} activeFilterCount={count} actions={<><Link href="/resident/calendar"><Button size="sm" variant="outline" className="h-10 px-2 sm:px-3"><ListFilter className="mr-1 h-4 w-4" /><span className="hidden sm:inline">ปฏิทิน</span></Button></Link><RequestAppointmentButton /></>} filters={<>
    <ResidentMultiFilterDropdown label="สถานะ" clearHref={href([], period, sort, keyword)} options={statusOptions.map(([value, label]) => ({ label, href: toggle(value), active: active.has(value) }))} />
    <ResidentFilterDropdown label="ช่วงเวลา" options={([['all', 'ทั้งหมด'], ['upcoming', 'กำลังจะมาถึง'], ['past', 'ที่ผ่านมา']] as const).map(([value, label]) => ({ label, href: href(statuses, value, sort, keyword), active: period === value }))} />
    <ResidentFilterDropdown label="เรียง" options={([['newest', 'สร้างล่าสุด'], ['oldest', 'สร้างเก่าสุด']] as const).map(([value, label]) => ({ label, href: href(statuses, period, value, keyword), active: sort === value }))} />
    {count > 0 ? <Link href={href([], "all", sort, keyword)} className="inline-flex h-9 items-center rounded-md px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500">ล้างตัวกรอง</Link> : null}
  </>} />;
}

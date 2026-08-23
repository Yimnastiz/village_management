"use client";

import Link from "next/link";
import { ResidentPageToolbar } from "@/components/resident/resident-page-toolbar";
import { NewsFilterChip } from "@/components/news/news-toolbar";
import { Button } from "@/components/ui/button";
import { ListFilter } from "lucide-react";
import { RequestAppointmentButton } from "./request-appointment-button";

type Status = "PENDING_APPROVAL" | "TIME_SUGGESTED" | "APPROVED" | "REJECTED" | "CANCELLED" | "COMPLETED";
type Props = { keyword: string; statuses: Status[]; period: "all" | "upcoming" | "past"; sort: "newest" | "oldest"; suggestions: string[] };

function href(statuses: Status[], period: Props["period"], sort: Props["sort"], keyword: string) {
  const params = new URLSearchParams();
  if (statuses.length) params.set("status", statuses.join(","));
  if (period !== "all") params.set("period", period);
  if (sort !== "newest") params.set("sort", sort);
  if (keyword.trim()) params.set("q", keyword.trim());
  const query = params.toString();
  return query ? `/resident/appointments?${query}` : "/resident/appointments";
}

export function ResidentAppointmentsToolbar({ keyword, statuses, period, sort, suggestions }: Props) {
  const active = new Set(statuses);
  const toggleStatus = (status: Status) => {
    const next = new Set(active);
    if (next.has(status)) next.delete(status); else next.add(status);
    return href(Array.from(next), period, sort, keyword);
  };
  const count = statuses.length + Number(period !== "all");
  const statusOptions: Array<[Status, string]> = [
    ["PENDING_APPROVAL", "รอตอบกลับ"], ["TIME_SUGGESTED", "รอยืนยันเวลา"], ["APPROVED", "ยืนยันแล้ว"],
    ["REJECTED", "ปฏิเสธ"], ["CANCELLED", "ยกเลิก"], ["COMPLETED", "เสร็จสิ้น"],
  ];
  return <ResidentPageToolbar namespace="resident-appointments" title="นัดหมาย" description="ติดตามนัดหมายของคุณ" registerHeader search={{ keyword, placeholder: "ค้นหาหัวข้อนัดหมาย", label: "ค้นหานัดหมาย", suggestions }} activeFilterCount={count} actions={<><Link href="/resident/calendar"><Button size="sm" variant="outline" className="h-10 px-2 sm:px-3"><ListFilter className="mr-1 h-4 w-4" /><span className="hidden sm:inline">ปฏิทิน</span></Button></Link><RequestAppointmentButton /></>} filters={<><span className="text-xs font-semibold text-gray-500">สถานะ</span>{statusOptions.map(([value, label]) => <NewsFilterChip key={value} href={toggleStatus(value)} active={active.has(value)}>{label}</NewsFilterChip>)}<span className="ml-1 text-xs font-semibold text-gray-500">ช่วงเวลา</span>{([['all', 'ทั้งหมด'], ['upcoming', 'กำลังจะมาถึง'], ['past', 'ที่ผ่านมา']] as const).map(([value, label]) => <NewsFilterChip key={value} href={href(statuses, value, sort, keyword)} active={period === value}>{label}</NewsFilterChip>)}<span className="ml-1 text-xs font-semibold text-gray-500">เรียง</span>{([['newest', 'สร้างล่าสุด'], ['oldest', 'สร้างเก่าสุด']] as const).map(([value, label]) => <NewsFilterChip key={value} href={href(statuses, period, value, keyword)} active={sort === value}>{label}</NewsFilterChip>)}<NewsFilterChip href={href([], "all", "newest", keyword)} active={false}>ล้างตัวกรอง</NewsFilterChip></>} />;
}

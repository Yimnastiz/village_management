"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ResidentFilterDropdown } from "@/components/resident/resident-page-toolbar";

export type ResidentCalendarItemType = "all" | "appointment" | "event";

export function ResidentCalendarTypeFilter({ type }: { type: ResidentCalendarItemType }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const href = (nextType: ResidentCalendarItemType) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextType === "all") params.delete("type");
    else params.set("type", nextType);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };
  const options = ([
    ["all", "ทั้งหมด"],
    ["appointment", "นัดหมาย"],
    ["event", "กิจกรรม"],
  ] as const).map(([value, label]) => ({ label, href: href(value), active: type === value }));

  return <div className="flex flex-wrap items-center gap-2">
    <ResidentFilterDropdown label="ประเภท" options={options} />
    {type !== "all" ? <Link href={href("all")} className="inline-flex h-9 items-center rounded-md px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500">ล้างตัวกรอง</Link> : null}
  </div>;
}

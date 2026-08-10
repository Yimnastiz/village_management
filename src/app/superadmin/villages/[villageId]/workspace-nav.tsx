"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const groups = [
  { label: "ภาพรวม", links: [["overview", "ภาพรวม"]] },
  { label: "ประชากรและสมาชิก", links: [["users", "สมาชิก"], ["admins", "ผู้ดูแลหมู่บ้าน"], ["houses", "บ้าน"], ["people", "ประชากร"], ["binding-requests", "คำขอผูกบ้าน"]] },
  { label: "การดำเนินงาน", links: [["issues", "ปัญหา"], ["appointments", "นัดหมาย"], ["calendar", "ปฏิทิน"]] },
  { label: "เนื้อหาหมู่บ้าน", links: [["news", "ข่าวสาร"], ["gallery", "แกลเลอรี"], ["places", "สถานที่สำคัญ"], ["contacts", "ผู้ติดต่อ"], ["downloads", "ดาวน์โหลด"], ["transparency", "ความโปร่งใส"]] },
  { label: "ระบบ", links: [["audit", "บันทึกการใช้งาน"]] },
] as const;

export function WorkspaceNav({ villageId }: { villageId: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="เมนูจัดการหมู่บ้าน" className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex gap-5 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible">
        {groups.map((group) => (
          <div key={group.label} className="shrink-0">
            <p className="px-2 pb-1 text-[11px] font-medium text-slate-400">{group.label}</p>
            <div className="flex gap-1">
              {group.links.map(([slug, label]) => {
                const href = `/superadmin/villages/${villageId}/${slug}`;
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return <Link key={slug} href={href} className={cn("whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition", active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950")}>{label}</Link>;
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}

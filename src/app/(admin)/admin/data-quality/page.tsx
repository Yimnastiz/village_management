import Link from "next/link";
import { ArrowRight, CircleCheckBig, Home, ShieldCheck, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { requireVillagePagePermission } from "@/lib/admin-permission.server";
import { getVillageDataQuality } from "@/features/data-quality/server/data-quality-service";

const number = (value: number) => value.toLocaleString("th-TH");

export default async function AdminDataQualityPage() {
  const context = await requireVillagePagePermission("data-quality.view", { callbackUrl: "/admin/data-quality" });
  const data = await getVillageDataQuality(context.villageId);
  const hasIssues = data.issueCount > 0;

  return <div data-admin-compact-top className="space-y-4">
    <AdminPageToolbar compact sticky title="คุณภาพข้อมูล" description="ตรวจสอบบัญชีและสมาชิกที่ควรได้รับการตรวจสอบภายในหมู่บ้าน" />
    <section aria-labelledby="data-quality-overview" className={`rounded-2xl p-5 shadow-sm ring-1 sm:p-6 ${hasIssues ? "bg-amber-50/70 ring-amber-100" : "bg-emerald-50/70 ring-emerald-100"}`}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {hasIssues ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" /> : <CircleCheckBig aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" />}
          <div className="min-w-0"><p className={`text-sm font-semibold ${hasIssues ? "text-amber-800" : "text-emerald-800"}`}>{hasIssues ? "มีข้อมูลที่ควรตรวจสอบ" : "สถานะข้อมูลปกติ"}</p><h1 id="data-quality-overview" className="mt-1 text-xl font-semibold tracking-tight text-gray-950">{hasIssues ? `พบ ${number(data.issueCount)} รายการที่ควรตรวจสอบ` : "ไม่พบรายการที่ต้องตรวจสอบ"}</h1></div>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 border-t border-black/5 pt-4 text-sm sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0"><div><dt className="text-gray-600">บัญชีข้อมูลซ้ำ</dt><dd className="mt-0.5 text-lg font-semibold text-gray-950">{number(data.duplicateCount)}</dd></div><div><dt className="text-gray-600">สมาชิกยังไม่มีบ้าน</dt><dd className="mt-0.5 text-lg font-semibold text-gray-950">{number(data.residentWithoutHouseCount)}</dd></div></dl>
      </div>
    </section>
    {hasIssues ? <section aria-label="รายการที่ควรตรวจสอบ" className="grid gap-4 lg:grid-cols-2">
      {data.duplicateCount > 0 ? <Issue title="บัญชีที่ต้องตรวจสอบข้อมูลซ้ำ" count={data.duplicateCount} detail="บัญชีที่ถูกระบุว่ามีข้อมูลซ้ำและยังไม่ได้คลี่คลาย" href="/admin/settings/access" icon={UserRound} names={data.duplicates.map((user) => user.name)} suffix="ข้อมูลบัญชีซ้ำ" /> : null}
      {data.residentWithoutHouseCount > 0 ? <Issue title="สมาชิกที่ยังไม่มีบ้านผูก" count={data.residentWithoutHouseCount} detail="สมาชิกที่ใช้งานอยู่แต่ยังไม่มีบ้านผูกในหมู่บ้านนี้" href="/admin/settings/access" icon={Home} names={data.residentsWithoutHouse.map((membership) => membership.user.name)} /> : null}
    </section> : <section aria-labelledby="data-quality-clear" className="rounded-2xl bg-white px-5 py-10 text-center shadow-sm ring-1 ring-gray-100"><CircleCheckBig aria-hidden="true" className="mx-auto h-9 w-9 text-emerald-600" /><h2 id="data-quality-clear" className="mt-3 text-lg font-semibold text-gray-950">ข้อมูลอยู่ในสถานะปกติ</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-500">ยังไม่พบข้อมูลที่เข้าข่ายต้องตรวจสอบตามเกณฑ์ของระบบ</p><div className="mt-5 flex flex-col gap-2 text-sm text-gray-500 sm:flex-row sm:justify-center sm:gap-6"><span>✓ ไม่พบบัญชีที่ถูกระบุว่ามีข้อมูลซ้ำ</span><span>✓ ไม่พบสมาชิกที่ใช้งานอยู่แต่ยังไม่มีบ้านผูก</span></div></section>}
  </div>;
}

function Issue({ title, count, detail, href, icon: Icon, names, suffix }: { title: string; count: number; detail: string; href: string; icon: LucideIcon; names: string[]; suffix?: string }) {
  return <article className="flex min-w-0 flex-col rounded-2xl bg-white shadow-sm ring-1 ring-gray-100"><header className="p-5 sm:p-6"><div className="flex min-w-0 items-start gap-3"><span className="rounded-xl bg-gray-50 p-2.5 text-gray-700 ring-1 ring-gray-100"><Icon aria-hidden="true" className="h-5 w-5" /></span><div className="min-w-0"><h2 className="break-words font-semibold text-gray-950">{title}</h2><p className="mt-1 text-sm text-gray-500"><span className="font-semibold text-gray-900">{number(count)}</span> รายการ</p><p className="mt-2 text-sm leading-6 text-gray-500">{detail}</p></div></div></header><div className="mx-5 divide-y divide-gray-100 border-t border-gray-100 sm:mx-6">{names.map((name) => <p key={name} className="break-words py-3 text-sm font-medium text-gray-800">{name}{suffix ? <span className="ml-2 text-xs font-normal text-gray-500">{suffix}</span> : null}</p>)}{count > names.length ? <p className="py-3 text-sm text-gray-500">และอีก {number(count - names.length)} รายการ</p> : null}</div><footer className="mt-auto p-5 sm:p-6"><Link href={href} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">ตรวจสอบรายการ <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></footer></article>;
}

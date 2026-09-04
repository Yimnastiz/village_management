import Link from "next/link";
import { ArrowRight, Building2, ClipboardCheck, Home, UserRound, Users } from "lucide-react";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

const number = (value: number) => value.toLocaleString("th-TH");
const duplicateUserWhere = { OR: [{ accountStatus: "DUPLICATE_ID" as const }, { duplicateOfUserId: { not: null }, duplicateResolvedAt: null }] };

export default async function DataQualityPage() {
  await requireSuperAdminPageSession();
  const residentWithoutHouseWhere = { role: "RESIDENT" as const, status: "ACTIVE" as const, houseId: null };
  const [villagesWithoutHeadmanCount, villagesWithoutHeadman, duplicateUsersCount, duplicateUsers, residentsWithoutHouseCount, residentsWithoutHouse, affectedVillageCount] = await Promise.all([
    prisma.village.count({ where: { isActive: true, memberships: { none: { role: "HEADMAN", status: "ACTIVE" } } } }),
    prisma.village.findMany({ where: { isActive: true, memberships: { none: { role: "HEADMAN", status: "ACTIVE" } } }, orderBy: [{ province: "asc" }, { district: "asc" }, { name: "asc" }], take: 8, select: { id: true, name: true, moo: true, district: true, province: true } }),
    prisma.user.count({ where: { systemRole: { not: "SUPERADMIN" }, ...duplicateUserWhere } }),
    prisma.user.findMany({ where: { systemRole: { not: "SUPERADMIN" }, ...duplicateUserWhere }, orderBy: { updatedAt: "desc" }, take: 8, select: { id: true, name: true, memberships: { select: { village: { select: { id: true, name: true, moo: true, district: true, province: true } } }, take: 1 } } }),
    prisma.villageMembership.count({ where: residentWithoutHouseWhere }),
    prisma.villageMembership.findMany({ where: residentWithoutHouseWhere, orderBy: { updatedAt: "desc" }, take: 8, select: { id: true, user: { select: { name: true } }, village: { select: { id: true, name: true, moo: true, district: true, province: true } } } }),
    prisma.village.count({ where: { OR: [{ isActive: true, memberships: { none: { role: "HEADMAN", status: "ACTIVE" } } }, { memberships: { some: residentWithoutHouseWhere } }, { memberships: { some: { user: { ...duplicateUserWhere } } } }] } }),
  ]);
  const issueCount = villagesWithoutHeadmanCount + duplicateUsersCount + residentsWithoutHouseCount;

  return <div className="mx-auto w-full max-w-[1500px] space-y-5">
    <SuperAdminPageHeaderRegistration context={{ title: "คุณภาพข้อมูล", description: "ตรวจสอบข้อมูลที่ไม่ครบถ้วน ผิดปกติ หรือควรได้รับการตรวจสอบทั่วทั้งระบบ" }} />
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="สรุปรายการที่ต้องตรวจสอบ">
      <SummaryCard label="รายการที่ต้องตรวจสอบ" value={issueCount} detail="นับตามเกณฑ์ที่ระบบตรวจสอบ" icon={ClipboardCheck} />
      <SummaryCard label="หมู่บ้านที่ได้รับผลกระทบ" value={affectedVillageCount} detail="นับหมู่บ้านไม่ซ้ำกัน" icon={Building2} />
      <SummaryCard label="บัญชีและสมาชิกที่ต้องตรวจสอบ" value={duplicateUsersCount + residentsWithoutHouseCount} detail="บัญชีซ้ำและสมาชิกที่ไม่มีบ้าน" icon={Users} />
    </section>
    {issueCount === 0 ? <section className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center shadow-sm"><ClipboardCheck className="mx-auto h-8 w-8 text-emerald-600" /><h2 className="mt-3 text-lg font-semibold text-gray-900">ยังไม่พบข้อมูลที่ต้องตรวจสอบ</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-500">ระบบยังไม่พบความไม่ครบถ้วนหรือความผิดปกติตามเกณฑ์ที่ตรวจสอบในขณะนี้</p></section> : <section className="grid gap-4 lg:grid-cols-3">
      <IssueCard title="หมู่บ้านที่ยังไม่มีผู้ใหญ่บ้าน" count={villagesWithoutHeadmanCount} meaning="หมู่บ้านที่เปิดใช้งานและไม่มีผู้ใหญ่บ้านที่มีสถานะใช้งาน" href="/superadmin/villages?searched=1&attention=missing-headman" icon={Building2}>{villagesWithoutHeadman.map((village) => <VillagePreview key={village.id} village={village} />)}</IssueCard>
      <IssueCard title="บัญชีผู้ใช้ที่ต้องตรวจสอบข้อมูลซ้ำ" count={duplicateUsersCount} meaning="บัญชีที่ถูกระบุว่าซ้ำและยังไม่ถูกคลี่คลาย" href="/superadmin/users?accountStatus=duplicate" icon={UserRound}>{duplicateUsers.map((user) => <UserPreview key={user.id} name={user.name} village={user.memberships[0]?.village} />)}</IssueCard>
      <IssueCard title="ข้อมูลสมาชิกที่ควรตรวจสอบ" count={residentsWithoutHouseCount} meaning="สมาชิกผู้อยู่อาศัยที่เปิดใช้งานแต่ไม่มีบ้านที่ผูกไว้" href="/superadmin/villages" icon={Home}>{residentsWithoutHouse.map((membership) => <UserPreview key={membership.id} name={membership.user.name} village={membership.village} />)}</IssueCard>
    </section>}
  </div>;
}

function SummaryCard({ label, value, detail, icon: Icon }: { label: string; value: number; detail: string; icon: typeof Building2 }) { return <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-gray-600">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">{number(value)}</p></div><span className="rounded-lg bg-cyan-50 p-2.5 text-cyan-700"><Icon className="h-5 w-5" /></span></div><p className="mt-3 text-xs text-gray-500">{detail}</p></div>; }
function IssueCard({ title, count, meaning, href, icon: Icon, children }: { title: string; count: number; meaning: string; href: string; icon: typeof Building2; children: React.ReactNode }) { return <article className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-white shadow-sm"><div className="border-b border-gray-100 p-4"><div className="flex items-start gap-3"><span className="rounded-lg bg-gray-100 p-2 text-gray-700"><Icon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="break-words text-base font-semibold text-gray-900">{title}</h2><p className="mt-2 text-2xl font-semibold text-gray-950">{number(count)} <span className="text-sm font-normal text-gray-500">รายการ</span></p><p className="mt-1 text-sm leading-5 text-gray-500">{meaning}</p></div></div></div><div className="min-h-[150px] flex-1 divide-y divide-gray-100 px-4">{count > 0 ? children : <p className="py-5 text-sm text-gray-500">ไม่พบรายการตามเกณฑ์นี้</p>}</div><div className="border-t border-gray-100 p-4"><Link href={href} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-medium text-cyan-700 transition hover:border-cyan-200 hover:bg-cyan-50">เปิดพื้นที่จัดการ<ArrowRight className="h-4 w-4" /></Link></div></article>; }
type VillageIdentity = { id: string; name: string; moo: string | null; district: string | null; province: string | null };
function villageLabel(village?: VillageIdentity) { return village ? `${village.name}${village.moo ? ` · หมู่ ${village.moo}` : ""}${village.district || village.province ? ` · ${[village.district, village.province].filter(Boolean).join(" / ")}` : ""}` : "ยังไม่พบหมู่บ้านที่ผูกไว้"; }
function VillagePreview({ village }: { village: VillageIdentity }) { return <p className="break-words py-3 text-sm text-gray-700">{villageLabel(village)}</p>; }
function UserPreview({ name, village }: { name: string; village?: VillageIdentity }) { return <div className="min-w-0 py-3"><p className="break-words text-sm font-medium text-gray-800">{name}</p>{village ? <Link href={`/superadmin/villages/${village.id}/users`} className="mt-0.5 block break-words text-xs text-gray-500 hover:text-cyan-700">{villageLabel(village)}</Link> : <p className="mt-0.5 break-words text-xs text-gray-500">{villageLabel(village)}</p>}</div>; }

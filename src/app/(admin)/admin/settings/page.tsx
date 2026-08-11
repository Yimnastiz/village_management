import Link from "next/link";
import { Building2, ShieldCheck, UserRound } from "lucide-react";
import { MembershipStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { computeLandingPath, getAdminMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const formatDate = (date: Date) => date.toLocaleString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const value = (input: string | null | undefined) => input?.trim() || "-";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid min-w-0 gap-1 border-b border-gray-100 py-2.5 last:border-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4"><dt className="text-sm text-gray-500">{label}</dt><dd className="min-w-0 break-words text-sm font-medium text-gray-900">{children}</dd></div>;
}

export default async function Page() {
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/admin/settings");
  const membership = getAdminMembership(session);
  if (!membership) redirect(computeLandingPath(session));
  const [village, memberCount, adminCount, pendingBindings] = await Promise.all([
    prisma.village.findUnique({ where: { id: membership.villageId }, select: { name: true, moo: true, slug: true, province: true, district: true, subdistrict: true, isActive: true, createdAt: true, updatedAt: true } }),
    prisma.villageMembership.count({ where: { villageId: membership.villageId, status: MembershipStatus.ACTIVE } }),
    prisma.villageMembership.count({ where: { villageId: membership.villageId, status: MembershipStatus.ACTIVE, role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] } } }),
    prisma.bindingRequest.count({ where: { villageId: membership.villageId, status: "PENDING" } }),
  ]);
  if (!village) redirect(computeLandingPath(session));

  return <div className="mx-auto max-w-5xl space-y-5"><header><h1 className="text-2xl font-bold text-gray-900">ตั้งค่าหมู่บ้าน</h1><p className="mt-1 text-sm text-gray-500">ตรวจสอบข้อมูลหมู่บ้านและจัดการค่าที่ผู้ใหญ่บ้านสามารถแก้ไขได้</p></header>
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium text-blue-700">พื้นที่ผู้ใหญ่บ้าน</p><h2 className="mt-1 text-lg font-semibold text-gray-900">{village.name}</h2></div><Badge variant={village.isActive ? "success" : "danger"}>{village.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}</Badge></div><dl className="mt-3 grid gap-x-8 md:grid-cols-2"><InfoRow label="หมู่ที่">{value(village.moo)}</InfoRow><InfoRow label="Slug"><span className="break-all">{village.slug}</span></InfoRow><InfoRow label="จังหวัด">{value(village.province)}</InfoRow><InfoRow label="อำเภอ">{value(village.district)}</InfoRow><InfoRow label="ตำบล">{value(village.subdistrict)}</InfoRow><InfoRow label="สร้างเมื่อ">{formatDate(village.createdAt)}</InfoRow><InfoRow label="อัปเดตล่าสุด">{formatDate(village.updatedAt)}</InfoRow></dl></section>
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-sm text-gray-500">สมาชิก</p><p className="mt-1 text-2xl font-bold text-gray-900">{memberCount.toLocaleString("th-TH")}</p></div><div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-sm text-gray-500">ผู้ดูแล</p><p className="mt-1 text-2xl font-bold text-gray-900">{adminCount.toLocaleString("th-TH")}</p></div><div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-sm text-gray-500">คำขอผูกบ้านรอพิจารณา</p><p className="mt-1 text-2xl font-bold text-gray-900">{pendingBindings.toLocaleString("th-TH")}</p></div></div>
    <div className="grid gap-4 md:grid-cols-3"><Link href="/admin/settings/village" className="rounded-xl border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50/40"><Building2 className="h-5 w-5 text-blue-700" /><p className="mt-3 font-medium text-gray-900">ข้อมูลหมู่บ้าน</p><p className="mt-1 text-sm text-gray-500">แก้ไขรายละเอียดติดต่อของหมู่บ้าน</p></Link><Link href="/admin/settings/roles" className="rounded-xl border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50/40"><ShieldCheck className="h-5 w-5 text-blue-700" /><p className="mt-3 font-medium text-gray-900">สิทธิ์ผู้ใช้งาน</p><p className="mt-1 text-sm text-gray-500">จัดการสิทธิ์ของสมาชิก</p></Link><Link href="/admin/profile" className="rounded-xl border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50/40"><UserRound className="h-5 w-5 text-blue-700" /><p className="mt-3 font-medium text-gray-900">โปรไฟล์ผู้ใหญ่บ้าน</p><p className="mt-1 text-sm text-gray-500">ดูแลข้อมูลบัญชีของคุณ</p></Link></div>
  </div>;
}

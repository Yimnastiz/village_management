import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

const links = [
  ["overview", "ภาพรวม"], ["admins", "ผู้ดูแล"], ["users", "ผู้ใช้"],
  ["binding-requests", "คำขอผูกบ้าน"], ["audit", "Audit Log"],
] as const;

export default async function VillageWorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ villageId: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId } = await params;
  const village = await prisma.village.findUnique({ where: { id: villageId }, select: { id: true, name: true, province: true, district: true, subdistrict: true, isActive: true } });
  if (!village) notFound();
  return <div className="space-y-4">
    <header className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-cyan-700">Super Admin Village Workspace</p><h1 className="text-xl font-bold text-slate-900">กำลังจัดการ: {village.name}</h1><p className="text-sm text-slate-600">ต.{village.subdistrict ?? "-"} อ.{village.district ?? "-"} จ.{village.province ?? "-"} · {village.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}</p></div><Link href="/superadmin/villages" className="rounded-md border border-cyan-300 bg-white px-3 py-2 text-sm text-cyan-800">กลับรายการหมู่บ้าน</Link></div>
      <p className="mt-2 text-xs text-amber-700">กำลังจัดการหมู่บ้านนี้ในฐานะ Super Admin การเปลี่ยนแปลงสำคัญจะถูกบันทึกใน Audit Log</p>
    </header>
    <nav className="flex gap-2 overflow-x-auto rounded-lg border bg-white p-2" aria-label="Village workspace navigation">{links.map(([slug, label]) => <Link key={slug} href={`/superadmin/villages/${villageId}/${slug}`} className="shrink-0 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-cyan-50">{label}</Link>)}</nav>
    {children}
  </div>;
}

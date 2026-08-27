import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

export default async function DataQualityPage() {
  await requireSuperAdminPageSession();
  const staleBefore = new Date();
  staleBefore.setDate(staleBefore.getDate() - 14);
  const [villagesWithoutHeadman, residentsWithoutHouse, usersWithoutMembership, emptyHouses, staleBindings, suspendedAdmins, incompleteVillages] = await Promise.all([
    prisma.village.findMany({ where: { memberships: { none: { role: "HEADMAN", status: "ACTIVE" } } }, select: { id: true, name: true } }),
    prisma.villageMembership.findMany({ where: { role: "RESIDENT", status: "ACTIVE", houseId: null }, take: 100, select: { id: true, user: { select: { name: true } }, village: { select: { name: true } } } }),
    prisma.user.findMany({ where: { accountStatus: "ACTIVE", memberships: { none: {} } }, take: 100, select: { id: true, name: true } }),
    prisma.house.findMany({ where: { memberships: { none: {} }, persons: { none: {} } }, take: 100, select: { id: true, houseNumber: true, village: { select: { name: true } } } }),
    prisma.bindingRequest.findMany({ where: { status: "PENDING", createdAt: { lt: staleBefore } }, take: 100, select: { id: true, createdAt: true, village: { select: { name: true } } } }),
    prisma.villageMembership.findMany({ where: { role: { in: ["HEADMAN", "ASSISTANT_HEADMAN"] }, status: { not: "ACTIVE" } }, take: 100, select: { id: true, role: true, status: true, user: { select: { name: true } }, village: { select: { name: true } } } }),
    prisma.village.findMany({ where: { OR: [{ province: null }, { district: null }, { subdistrict: null }] }, select: { id: true, name: true } }),
  ]);
  const groups = [
    ["หมู่บ้านไม่มีผู้ใหญ่บ้าน", villagesWithoutHeadman.map((x)=>x.name)],
    ["Resident Membership ไม่มี houseId", residentsWithoutHouse.map((x)=>`${x.user.name} · ${x.village.name}`)],
    ["ผู้ใช้ไม่มี Membership", usersWithoutMembership.map((x)=>x.name)],
    ["บ้านไม่มีสมาชิก", emptyHouses.map((x)=>`${x.village.name} · ${x.houseNumber}`)],
    ["BindingRequest ค้างเกิน 14 วัน", staleBindings.map((x)=>`${x.village?.name ?? "ไม่ระบุหมู่บ้าน"} · ${x.createdAt.toLocaleDateString("th-TH")}`)],
    ["ผู้ดูแลไม่ได้ ACTIVE", suspendedAdmins.map((x)=>`${x.user.name} · ${x.village.name} · ${x.role}/${x.status}`)],
    ["ข้อมูลพื้นที่ไม่ครบ", incompleteVillages.map((x)=>x.name)],
  ] as const;
  return <div className="space-y-6"><div className="grid gap-4 lg:grid-cols-2">{groups.map(([title,rows])=><section key={title} className="rounded-xl border bg-white p-4"><h2 className="font-semibold">{title} <span className="text-slate-400">({rows.length})</span></h2><div className="mt-2 max-h-64 overflow-auto text-sm text-slate-600">{rows.length===0?<p>ไม่พบปัญหา</p>:rows.map((row,index)=><p key={`${row}-${index}`} className="border-b py-1.5">{row}</p>)}</div></section>)}</div></div>;
}

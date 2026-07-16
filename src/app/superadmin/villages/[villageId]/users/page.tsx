import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

export default async function VillageUsersPage({ params }: { params: Promise<{ villageId: string }> }) {
  await requireSuperAdminPageSession(); const { villageId } = await params;
  const rows = await prisma.villageMembership.findMany({ where: { villageId }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, role: true, status: true, joinedAt: true, house: { select: { houseNumber: true } }, user: { select: { name: true, phoneNumber: true } }, village: { select: { name: true, subdistrict: true, district: true, province: true } } } });
  return <section className="rounded-xl border bg-white p-4"><h2 className="text-lg font-semibold">ผู้ใช้และ Membership</h2><div className="mt-3 grid gap-2">{rows.map((row) => <div key={row.id} className="rounded-lg border p-3 text-sm"><p className="font-medium">{row.user.name} · {row.role} · {row.status}</p><p className="text-slate-500">{row.user.phoneNumber.replace(/(\d{2})\d+(\d{4})$/, "$1******$2")} · บ้าน {row.house?.houseNumber ?? "-"} · เริ่ม {row.joinedAt?.toLocaleDateString("th-TH") ?? "-"}</p><p className="text-xs text-slate-500">{row.village.name} · ต.{row.village.subdistrict ?? "-"} อ.{row.village.district ?? "-"} จ.{row.village.province ?? "-"}</p></div>)}</div></section>;
}

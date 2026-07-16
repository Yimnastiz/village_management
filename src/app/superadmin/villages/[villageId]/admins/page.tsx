import { VillageMembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

export default async function VillageAdminsPage({ params }: { params: Promise<{ villageId: string }> }) {
  await requireSuperAdminPageSession(); const { villageId } = await params;
  const rows = await prisma.villageMembership.findMany({ where: { villageId, role: { in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN, VillageMembershipRole.COMMITTEE] } }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, role: true, status: true, joinedAt: true, user: { select: { name: true, phoneNumber: true } } } });
  return <section className="rounded-xl border bg-white p-4"><h2 className="text-lg font-semibold">ผู้ดูแลหมู่บ้าน</h2><div className="mt-3 grid gap-2">{rows.length ? rows.map((row) => <div key={row.id} className="rounded-lg border p-3 text-sm"><p className="font-medium">{row.user.name} · {row.role}</p><p className="text-slate-500">{row.user.phoneNumber.replace(/(\d{2})\d+(\d{4})$/, "$1******$2")} · {row.status} · แต่งตั้ง {row.joinedAt?.toLocaleDateString("th-TH") ?? "-"}</p></div>) : <p className="text-sm text-slate-500">ยังไม่มีผู้ดูแล</p>}</div></section>;
}

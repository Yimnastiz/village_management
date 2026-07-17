import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

const coreLinks = [
  ["overview", "ภาพรวม"],
  ["admins", "ผู้ดูแล"],
  ["users", "ผู้ใช้"],
  ["binding-requests", "คำขอผูกบ้าน"],
  ["audit", "Audit Log"],
] as const;

const publicLinks = [
  ["news", "ข่าวสาร"],
  ["contacts", "รายชื่อผู้ติดต่อ"],
  ["places", "สถานที่สำคัญ"],
  ["calendar", "ปฏิทินกิจกรรม"],
  ["transparency", "ความโปร่งใส"],
] as const;

function NavGroup({
  title,
  links,
  villageId,
}: {
  title: string;
  links: readonly (readonly [string, string])[];
  villageId: string;
}) {
  return (
    <div className="min-w-full space-y-2 md:min-w-0">
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {links.map(([slug, label]) => (
          <Link
            key={slug}
            href={`/superadmin/villages/${villageId}/${slug}`}
            className="shrink-0 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-cyan-50 hover:text-cyan-900"
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function VillageWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ villageId: string }>;
}) {
  await requireSuperAdminPageSession();
  const { villageId } = await params;
  const village = await prisma.village.findUnique({
    where: { id: villageId },
    select: { id: true, name: true, province: true, district: true, subdistrict: true, isActive: true },
  });
  if (!village) notFound();

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase text-cyan-700">Super Admin Village Workspace</p>
              <Badge variant="warning">Super Admin Support Mode</Badge>
            </div>
            <h1 className="text-xl font-bold text-slate-900">กำลังจัดการ: {village.name}</h1>
            <p className="text-sm text-slate-600">
              ต.{village.subdistrict ?? "-"} อ.{village.district ?? "-"} จ.{village.province ?? "-"} · {village.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
            </p>
          </div>
          <Link href="/superadmin/villages" className="rounded-md border border-cyan-300 bg-white px-3 py-2 text-sm text-cyan-800">
            กลับรายการหมู่บ้าน
          </Link>
        </div>
        <p className="mt-2 text-xs text-amber-700">
          กำลังจัดการหมู่บ้านนี้ในฐานะ Super Admin การเปลี่ยนแปลงสำคัญจะถูกบันทึกใน Audit Log
        </p>
      </header>

      <nav className="grid gap-3 rounded-lg border bg-white p-2 md:grid-cols-[1fr_1fr]" aria-label="Village workspace navigation">
        <NavGroup title="Core Management" links={coreLinks} villageId={villageId} />
        <NavGroup title="Public Content" links={publicLinks} villageId={villageId} />
      </nav>

      {children}
    </div>
  );
}


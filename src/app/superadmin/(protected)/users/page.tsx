import Link from "next/link";
import { QueryPagination } from "@/components/ui/query-pagination";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { UserManagementCard } from "./user-management-client";
import { finalizeDueAccountDeletions } from "@/lib/account-deletion";

const ADMIN_ROLES = ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] as const;

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? `XXX-XXX-${digits.slice(-4)}` : "-";
}

type PageProps = {
  searchParams?: Promise<{ q?: string; systemRole?: string; adminRole?: string; page?: string }>;
};

export default async function SuperAdminUsersPage({ searchParams }: PageProps) {
  await requireSuperAdminPageSession();
  await finalizeDueAccountDeletions();
  const params = (searchParams ? await searchParams : {}) ?? {};
  const keyword = (params.q ?? "").trim();
  const systemRole = (params.systemRole ?? "all").trim();
  const adminRole = (params.adminRole ?? "all").trim();
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = 12;

  const where = {
    systemRole: { not: "SUPERADMIN" as const },
    ...(systemRole === "USER" ? { systemRole: "USER" as const } : {}),
    ...(adminRole === "admin"
      ? { memberships: { some: { role: { in: [...ADMIN_ROLES] } } } }
      : {}),
    ...(adminRole !== "all" && adminRole !== "admin"
      ? { memberships: { some: { role: adminRole as (typeof ADMIN_ROLES)[number] } } }
      : {}),
    ...(keyword
      ? {
          OR: [
            { name: { contains: keyword, mode: "insensitive" as const } },
            { phoneNumber: { contains: keyword, mode: "insensitive" as const } },
            { email: { contains: keyword, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [users, villages, totalCount] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        systemRole: true,
        accountStatus: true,
        registrationProvince: true,
        registrationDistrict: true,
        registrationSubdistrict: true,
        registrationVillage: { select: { name: true } },
        memberships: {
          select: {
            id: true,
            role: true,
            status: true,
            village: {
              select: { id: true, name: true, subdistrict: true, district: true, province: true },
            },
            house: { select: { houseNumber: true } },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    }),
    prisma.village.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      <form method="GET" className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <input name="q" defaultValue={keyword} placeholder="ค้นหาชื่อ เบอร์โทร หรืออีเมล" className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
        <select name="systemRole" defaultValue={systemRole} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="all">ทุก System Role</option>
          <option value="USER">USER</option>
        </select>
        <select name="adminRole" defaultValue={adminRole} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="all">ทุกบทบาทหมู่บ้าน</option>
          <option value="admin">ผู้บริหารหมู่บ้านทั้งหมด</option>
          <option value="HEADMAN">HEADMAN</option>
          <option value="ASSISTANT_HEADMAN">ASSISTANT_HEADMAN</option>
          <option value="COMMITTEE">COMMITTEE</option>
        </select>
        <div className="md:col-span-4 flex flex-wrap gap-2">
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">ค้นหา</button>
          <Link href="/superadmin/users" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">ล้างตัวกรอง</Link>
        </div>
      </form>

      <div className="space-y-3">
        {users.map((user) => {
          return (
            <UserManagementCard key={user.id} user={{ ...user, phoneNumber: maskPhone(user.phoneNumber) }} villages={villages} />
          );
        })}
        {users.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">ไม่พบผู้ใช้ตามตัวกรองที่เลือก</div> : null}
      </div>

      <QueryPagination pathname="/superadmin/users" page={page} totalPages={totalPages} params={{ q: keyword || undefined, systemRole: systemRole !== "all" ? systemRole : undefined, adminRole: adminRole !== "all" ? adminRole : undefined }} />
    </div>
  );
}

import Link from "next/link";
import { QueryPagination } from "@/components/ui/query-pagination";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { UserManagementCard } from "./user-management-client";
import { finalizeDueAccountDeletions } from "@/lib/account-deletion";

const ADMIN_ROLES = ["HEADMAN", "ASSISTANT_HEADMAN"] as const;

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
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-medium text-slate-500">ผู้ใช้ที่พบ</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{totalCount.toLocaleString("th-TH")}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-medium text-slate-500">หมู่บ้านที่พร้อมใช้งาน</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{villages.length.toLocaleString("th-TH")}</p>
        </div>
        <div className="col-span-2 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 sm:col-span-1">
          <p className="text-xs font-medium text-cyan-700">กำลังแสดง</p>
          <p className="mt-1 text-sm font-semibold text-cyan-950">หน้า {page} จาก {totalPages}</p>
          <p className="mt-0.5 text-xs text-cyan-700">รายการล่าสุดก่อน</p>
        </div>
      </div>

      <form method="GET" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">ค้นหาและกรองผู้ใช้</h2>
            <p className="mt-0.5 text-xs text-slate-500">ค้นหาจากชื่อ เบอร์โทร หรืออีเมล แล้วเลือกบทบาทที่ต้องการ</p>
          </div>
          <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 sm:inline-flex">{totalCount.toLocaleString("th-TH")} รายการ</span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="md:col-span-2">
            <span className="sr-only">ค้นหาผู้ใช้</span>
            <input name="q" defaultValue={keyword} placeholder="ค้นหาชื่อ เบอร์โทร หรืออีเมล" className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10" />
          </label>
          <label>
            <span className="sr-only">System Role</span>
            <select name="systemRole" defaultValue={systemRole} className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm outline-none transition hover:border-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10">
          <option value="all">ทุก System Role</option>
          <option value="USER">USER</option>
            </select>
          </label>
          <label>
            <span className="sr-only">บทบาทหมู่บ้าน</span>
            <select name="adminRole" defaultValue={adminRole} className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm outline-none transition hover:border-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10">
          <option value="all">ทุกบทบาทหมู่บ้าน</option>
          <option value="admin">ผู้บริหารหมู่บ้านทั้งหมด</option>
          <option value="HEADMAN">HEADMAN</option>
          <option value="ASSISTANT_HEADMAN">ASSISTANT_HEADMAN</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button type="submit" className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-900/15">ค้นหา</button>
          <Link href="/superadmin/users" className="inline-flex h-10 items-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-900/10">ล้างตัวกรอง</Link>
        </div>
      </form>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">รายการผู้ใช้</h2>
          <p className="text-sm text-slate-500">ตรวจสอบข้อมูลและจัดการสิทธิ์จากรายการด้านล่าง</p>
        </div>
      </div>
      <div className="space-y-4">
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

import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { QueryPagination } from "@/components/ui/query-pagination";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { MEMBERSHIP_ROLE_LABELS } from "@/lib/constants";
import { finalizeDueAccountDeletions } from "@/lib/account-deletion";
import { UserManagementCard } from "./user-management-client";

const ADMIN_ROLES = ["HEADMAN", "ASSISTANT_HEADMAN"] as const;

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? `XXX-XXX-${digits.slice(-4)}` : "-";
}

type PageProps = { searchParams?: Promise<{ q?: string; adminRole?: string; page?: string }> };

export default async function SuperAdminUsersPage({ searchParams }: PageProps) {
  await requireSuperAdminPageSession();
  await finalizeDueAccountDeletions();
  const params = (searchParams ? await searchParams : {}) ?? {};
  const keyword = (params.q ?? "").trim();
  const adminRole = (params.adminRole ?? "all").trim();
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = 12;
  const where = {
    systemRole: { not: "SUPERADMIN" as const },
    ...(adminRole === "admin" ? { memberships: { some: { role: { in: [...ADMIN_ROLES] } } } } : {}),
    ...(adminRole !== "all" && adminRole !== "admin" ? { memberships: { some: { role: adminRole as (typeof ADMIN_ROLES)[number] } } } : {}),
    ...(keyword ? { OR: [
      { name: { contains: keyword, mode: "insensitive" as const } },
      { phoneNumber: { contains: keyword, mode: "insensitive" as const } },
      { email: { contains: keyword, mode: "insensitive" as const } },
    ] } : {}),
  };

  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
      select: {
        id: true, name: true, phoneNumber: true, accountStatus: true,
        registrationProvince: true, registrationDistrict: true, registrationSubdistrict: true,
        registrationVillage: { select: { name: true, moo: true } },
        memberships: { select: { id: true, role: true, status: true, village: { select: { id: true, name: true, moo: true, subdistrict: true, district: true, province: true } }, house: { select: { houseNumber: true } } }, orderBy: { updatedAt: "desc" } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasFilters = Boolean(keyword || adminRole !== "all");
  const withCurrentQuery = (extra: Record<string, string>) => {
    const query = new URLSearchParams();
    if (keyword) query.set("q", keyword);
    if (adminRole !== "all") query.set("adminRole", adminRole);
    Object.entries(extra).forEach(([key, value]) => query.set(key, value));
    query.delete("page");
    const value = query.toString();
    return value ? `/superadmin/users?${value}` : "/superadmin/users";
  };

  return (
    <div className="workspace-list-page -mt-4 mx-auto flex min-h-0 w-full max-w-[1500px] flex-col gap-2 sm:-mt-6 sm:overflow-visible">
      <SuperAdminPageHeaderRegistration context={{ title: "ผู้ใช้งานระบบ", description: "ค้นหา ตรวจสอบ และสนับสนุนบัญชีผู้ใช้งานทุกหมู่บ้าน" }} />
      <AdminListToolbar
        compact
        sticky
        hideHeading
        title="ผู้ใช้งานระบบ"
        description="ค้นหา ตรวจสอบ และสนับสนุนบัญชีผู้ใช้งานทุกหมู่บ้าน"
        searchAction="/superadmin/users"
        clearHref="/superadmin/users"
        keyword={keyword}
        searchLabel="ค้นหาผู้ใช้งาน"
        searchPlaceholder="ค้นหาชื่อ เบอร์โทร หรือข้อมูลผู้ใช้"
        groups={[{
          label: "บทบาทหมู่บ้าน",
          options: [
            { label: "ทุกบทบาท", href: withCurrentQuery({ adminRole: "all" }), active: adminRole === "all", isDefault: true },
            { label: "ผู้บริหารหมู่บ้านทั้งหมด", href: withCurrentQuery({ adminRole: "admin" }), active: adminRole === "admin" },
            { label: MEMBERSHIP_ROLE_LABELS.HEADMAN, href: withCurrentQuery({ adminRole: "HEADMAN" }), active: adminRole === "HEADMAN" },
            { label: MEMBERSHIP_ROLE_LABELS.ASSISTANT_HEADMAN, href: withCurrentQuery({ adminRole: "ASSISTANT_HEADMAN" }), active: adminRole === "ASSISTANT_HEADMAN" },
          ],
        }]}
      />

      <section className="space-y-2">
        <p className="px-1 text-sm text-gray-500">พบ {totalCount.toLocaleString("th-TH")} บัญชี</p>
        {users.map((user) => (
          <UserManagementCard
            key={user.id}
            user={{ ...user, phoneNumber: maskPhone(user.phoneNumber) }}
          />
        ))}
        {users.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-white p-8 text-center">
            <p className="font-medium text-gray-700">{hasFilters ? "ไม่พบผู้ใช้งานที่ตรงกับเงื่อนไข" : "ยังไม่มีผู้ใช้งาน"}</p>
            <p className="mt-1 text-sm text-gray-500">{hasFilters ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง" : "เมื่อมีบัญชีผู้ใช้งาน รายการจะแสดงที่นี่"}</p>
          </div>
        ) : null}
      </section>

      <QueryPagination
        pathname="/superadmin/users"
        page={page}
        totalPages={totalPages}
        params={{ q: keyword || undefined, adminRole: adminRole !== "all" ? adminRole : undefined }}
      />
    </div>
  );
}

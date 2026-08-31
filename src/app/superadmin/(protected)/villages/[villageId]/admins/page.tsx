import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { getVillageAdministrators, getVillageEligibleAdminUsers, getWorkspaceVillage } from "@/features/village-workspace/server/queries";
import { AdminManagement } from "./admin-management";

export default async function VillageAdminsPage({ params, searchParams }: { params: Promise<{ villageId: string }>; searchParams: Promise<{ q?: string; role?: string; status?: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId } = await params;
  const search = await searchParams;
  const keyword = (search.q ?? "").trim();
  const role = ["HEADMAN", "ASSISTANT_HEADMAN"].includes(search.role ?? "") ? search.role! : "ALL";
  const status = ["ACTIVE", "SUSPENDED"].includes(search.status ?? "") ? search.status! : "ALL";
  const [village, result, users, headmanResult] = await Promise.all([
    getWorkspaceVillage(villageId), getVillageAdministrators(villageId, { query: keyword, role, status }), getVillageEligibleAdminUsers(villageId), getVillageAdministrators(villageId, { role: "HEADMAN", status: "ACTIVE" }),
  ]);
  const base = `/superadmin/villages/${villageId}/admins`;
  const href = (nextRole = role, nextStatus = status) => {
    const query = new URLSearchParams(); if (keyword) query.set("q", keyword); if (nextRole !== "ALL") query.set("role", nextRole); if (nextStatus !== "ALL") query.set("status", nextStatus);
    return query.size ? `${base}?${query}` : base;
  };
  const activeHeadman = headmanResult.rows[0]?.user.id ?? null;
  return <div className="flex min-h-0 flex-col sm:h-[calc(100dvh-var(--app-topbar-visible-offset,4rem)-2rem)]">
    <SuperAdminPageHeaderRegistration priority={1} context={{ title: "ผู้ดูแลหมู่บ้าน", description: `จัดการผู้ใหญ่บ้านและผู้ช่วยผู้ใหญ่บ้านของ ${village.name}` }} />
    <AdminListToolbar sticky hideHeading title="ผู้ดูแลหมู่บ้าน" description={`จัดการผู้ใหญ่บ้านและผู้ช่วยผู้ใหญ่บ้านของ ${village.name}`} searchAction={base} clearHref={href("ALL", "ALL")} keyword={keyword} searchLabel="ค้นหา" searchPlaceholder="ค้นหาชื่อ โทรศัพท์ หรืออีเมล" groups={[
      { label: "บทบาท", options: [{ label: "ทุกบทบาท", href: href("ALL", status), active: role === "ALL", isDefault: true }, { label: "ผู้ใหญ่บ้าน", href: href("HEADMAN", status), active: role === "HEADMAN" }, { label: "ผู้ช่วยผู้ใหญ่บ้าน", href: href("ASSISTANT_HEADMAN", status), active: role === "ASSISTANT_HEADMAN" }] },
      { label: "สถานะ", options: [{ label: "ทุกสถานะ", href: href(role, "ALL"), active: status === "ALL", isDefault: true }, { label: "ใช้งานอยู่", href: href(role, "ACTIVE"), active: status === "ACTIVE" }, { label: "ระงับ", href: href(role, "SUSPENDED"), active: status === "SUSPENDED" }] },
    ]} />
    <div className="min-h-0 overflow-y-auto pb-4"><AdminManagement villageId={villageId} users={users.map((user) => ({ id: user.id, name: user.name, phoneNumber: user.phoneNumber }))} admins={result.rows.map((row) => ({ ...row, role: row.role as "HEADMAN" | "ASSISTANT_HEADMAN", status: row.status as "ACTIVE" | "SUSPENDED", createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }))} activeHeadmanId={activeHeadman} /></div>
  </div>;
}

import Link from "next/link";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { getVillageEligibleAdminUsers, getVillageMembers, getWorkspaceVillage } from "@/features/village-workspace/server/queries";
import { serializeMemberRows } from "@/features/village-workspace/utils";
import { AdminAssignmentDialog } from "../admin-assignment-dialog";
import { MemberList } from "../member-list";
import { WorkspaceListPage } from "../workspace-list-page";

export default async function VillageUsersPage({ params, searchParams }: { params: Promise<{ villageId: string }>; searchParams: Promise<{ q?: string; role?: string; status?: string; view?: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId } = await params;
  const search = await searchParams;
  const base = `/superadmin/villages/${villageId}/users`;
  const keyword = (search.q ?? "").trim();
  const view = search.view === "admins" ? "admins" : "all";
  const requestedRole = search.role ?? "ALL";
  const role = view === "admins" && requestedRole === "RESIDENT" ? "ALL" : requestedRole;
  const status = search.status ?? "ALL";
  const [village, result, houses, eligibleUsers] = await Promise.all([getWorkspaceVillage(villageId), getVillageMembers(villageId, { query: keyword, role, status, adminOnly: view === "admins" }), prisma.house.findMany({ where: { villageId }, orderBy: { houseNumber: "asc" }, select: { id: true, houseNumber: true } }), getVillageEligibleAdminUsers(villageId)]);
  const href = (nextRole = role, nextStatus = status, nextView = view) => { const query = new URLSearchParams(); if (nextView === "admins") query.set("view", "admins"); if (keyword) query.set("q", keyword); if (nextRole !== "ALL") query.set("role", nextRole); if (nextStatus !== "ALL") query.set("status", nextStatus); const value = query.toString(); return value ? `${base}?${value}` : base; };
  const title = view === "admins" ? "ผู้ดูแล" : "สมาชิกและผู้ดูแล";
  const description = view === "admins" ? `ผู้ดูแล ${result.total.toLocaleString("th-TH")} คน · เฉพาะ ${village.name}` : `สมาชิกทั้งหมด ${result.total.toLocaleString("th-TH")} คน · เฉพาะในหมู่บ้านนี้`;
  const roleOptions = view === "admins" ? [{ label: "ทุกบทบาท", href: href("ALL", status), active: role === "ALL", isDefault: true }, { label: "ผู้ใหญ่บ้าน", href: href("HEADMAN", status), active: role === "HEADMAN" }, { label: "ผู้ช่วยผู้ใหญ่บ้าน", href: href("ASSISTANT_HEADMAN", status), active: role === "ASSISTANT_HEADMAN" }] : [{ label: "ทุกบทบาท", href: href("ALL", status), active: role === "ALL", isDefault: true }, { label: "ลูกบ้าน", href: href("RESIDENT", status), active: role === "RESIDENT" }, { label: "ผู้ใหญ่บ้าน", href: href("HEADMAN", status), active: role === "HEADMAN" }, { label: "ผู้ช่วยผู้ใหญ่บ้าน", href: href("ASSISTANT_HEADMAN", status), active: role === "ASSISTANT_HEADMAN" }];
  const toolbarActions = <div className="flex flex-wrap items-center gap-2"><div className="flex w-fit rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm font-medium"><Link href={href(role, status, "all")} className={`rounded-md px-3 py-1.5 ${view === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>ทั้งหมด</Link><Link href={href(role === "RESIDENT" ? "ALL" : role, status, "admins")} className={`rounded-md px-3 py-1.5 ${view === "admins" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>ผู้ดูแล</Link></div><AdminAssignmentDialog villageId={villageId} users={eligibleUsers} /></div>;
  return <WorkspaceListPage><div className="flex min-h-0 flex-col sm:h-[calc(100dvh-var(--app-topbar-visible-offset,4rem)-2rem)] sm:overflow-visible"><SuperAdminPageHeaderRegistration priority={1} context={{ title, description }} /><AdminListToolbar sticky hideHeading title={title} description={description} searchAction={base} clearHref={href("ALL", "ALL")} keyword={keyword} searchLabel="ค้นหาสมาชิก" searchPlaceholder="ค้นหาชื่อ เบอร์โทร หรือบ้านเลขที่" actions={toolbarActions} groups={[{ label: "บทบาท", options: roleOptions }, { label: "สถานะ", options: [{ label: "ทุกสถานะ", href: href(role, "ALL"), active: status === "ALL", isDefault: true }, { label: "ใช้งานอยู่", href: href(role, "ACTIVE"), active: status === "ACTIVE" }, { label: "รอตรวจสอบ", href: href(role, "PENDING"), active: status === "PENDING" }, { label: "ระงับ", href: href(role, "SUSPENDED"), active: status === "SUSPENDED" }, { label: "ไม่อนุมัติ", href: href(role, "REJECTED"), active: status === "REJECTED" }] }]} /><MemberList rows={serializeMemberRows(result.rows)} total={result.total} villageId={villageId} villageName={village.name} houses={houses} /></div></WorkspaceListPage>;
}

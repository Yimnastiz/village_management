import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { getVillageEligibleAdminUsers, getVillageMembers, getWorkspaceVillage } from "@/features/village-workspace/server/queries";
import { MemberList } from "../member-list";
import { setVillageAdminSupportAction } from "../actions";
import { SupportSubmitButton } from "../support-submit-button";

export default async function VillageAdminsPage({ params, searchParams }: { params: Promise<{ villageId: string }>; searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }> }) {
  await requireSuperAdminPageSession(); const { villageId } = await params; const search = await searchParams;
  const [village, result, houses, eligibleUsers] = await Promise.all([
    getWorkspaceVillage(villageId),
    getVillageMembers(villageId, { query: search.q, role: search.role, status: search.status, page: Number(search.page) || 1, adminOnly: true }),
    prisma.house.findMany({ where: { villageId }, orderBy: { houseNumber: "asc" }, select: { id: true, houseNumber: true } }),
    getVillageEligibleAdminUsers(villageId),
  ]);
  const base = `/superadmin/villages/${villageId}/admins`; const kept = new URLSearchParams(); if (search.q) kept.set("q", search.q); if (search.role) kept.set("role", search.role); if (search.status) kept.set("status", search.status); const queryString = kept.size ? `?${kept}` : "";
  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-xl font-semibold text-slate-950">ผู้ดูแลหมู่บ้าน</h2><p className="mt-1 text-sm text-slate-500">จัดการผู้ใหญ่บ้านและผู้ช่วยผู้ใหญ่บ้าน เฉพาะ {village.name}</p></div><details className="sm:w-auto"><summary className="cursor-pointer list-none rounded-lg bg-slate-900 px-4 py-2.5 text-center text-sm font-medium text-white">แต่งตั้งผู้ดูแล</summary><form action={setVillageAdminSupportAction.bind(null, villageId)} className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:w-[34rem] sm:grid-cols-2"><label className="text-sm text-slate-600">บัญชีผู้ใช้<select name="userId" required className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3"><option value="">เลือกผู้ใช้ในหมู่บ้านนี้</option>{eligibleUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label className="text-sm text-slate-600">ตำแหน่ง<select name="role" className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3"><option value="HEADMAN">ผู้ใหญ่บ้าน</option><option value="ASSISTANT_HEADMAN">ผู้ช่วยผู้ใหญ่บ้าน</option></select></label><input name="reason" required minLength={5} placeholder="เหตุผลการแต่งตั้ง" className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm sm:col-span-2" /><SupportSubmitButton villageName={village.name} className="min-h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white sm:col-span-2">ยืนยันการแต่งตั้ง</SupportSubmitButton>{eligibleUsers.length === 0 ? <p className="text-xs text-slate-500 sm:col-span-2">ไม่มีบัญชีที่มี membership หรือ registration อยู่ในหมู่บ้านนี้</p> : null}</form></details></div>
    <form action={base} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(12rem,1fr)_auto_auto_auto]"><input type="search" name="q" defaultValue={search.q} placeholder="ค้นหาชื่อ เบอร์โทร หรือบ้านเลขที่" className="min-h-10 min-w-0 rounded-lg border border-slate-300 px-3 text-sm" /><select name="role" defaultValue={search.role ?? "ALL"} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="ALL">ทุกตำแหน่ง</option><option value="HEADMAN">ผู้ใหญ่บ้าน</option><option value="ASSISTANT_HEADMAN">ผู้ช่วยผู้ใหญ่บ้าน</option></select><select name="status" defaultValue={search.status ?? "ALL"} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="ALL">ทุกสถานะ</option><option value="ACTIVE">ใช้งานอยู่</option><option value="SUSPENDED">ระงับ</option></select><div className="flex gap-2"><button className="min-h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white">ค้นหา</button><Link href={base} className="inline-flex min-h-10 items-center rounded-lg border px-3 text-sm">ล้าง</Link></div></form>
    <MemberList {...result} villageId={villageId} villageName={village.name} houses={houses} queryString={queryString} returnTo="admins" />
  </div>;
}

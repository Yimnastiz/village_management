import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { AdminFilterDropdown, type ToolbarGroup } from "@/components/ui/admin-list-toolbar";
import { requireVillagePagePermission } from "@/lib/admin-permission.server";
import { listVillageBroadcasts } from "@/features/broadcasts/server/broadcast-service";
import { createAdminVillageBroadcastAction } from "./actions";
import { BroadcastComposer } from "./broadcast-composer";
import { broadcastExpiryLabel, broadcastStatusClassName, broadcastStatusLabels, type BroadcastDisplayStatus } from "./broadcast-presentation";

type Props = { searchParams?: Promise<{ q?: string; status?: string; page?: string }> };

function href(values: { q: string; status: string; page?: number }) {
  const params = new URLSearchParams();
  if (values.q) params.set("q", values.q);
  if (values.status !== "all") params.set("status", values.status);
  if (values.page && values.page > 1) params.set("page", String(values.page));
  const query = params.toString();
  return query ? `/admin/broadcasts?${query}` : "/admin/broadcasts";
}

export default async function AdminBroadcastsPage({ searchParams }: Props) {
  const context = await requireVillagePagePermission("broadcasts.manage", { callbackUrl: "/admin/broadcasts" });
  const params = await searchParams ?? {};
  const q = (params.q ?? "").trim();
  const status = ["all", "active", "expired", "cancelled"].includes(params.status ?? "") ? params.status! : "all";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const { rows, total, now } = await listVillageBroadcasts(context.villageId, q, status, page);
  const totalPages = Math.max(1, Math.ceil(total / 15));
  const statusGroup: ToolbarGroup = { label: "สถานะ", options: [
    { label: "ทั้งหมด", href: href({ q, status: "all" }), active: status === "all", isDefault: true },
    { label: "กำลังแสดง", href: href({ q, status: "active" }), active: status === "active" },
    { label: "หมดอายุ", href: href({ q, status: "expired" }), active: status === "expired" },
    { label: "ยกเลิกแล้ว", href: href({ q, status: "cancelled" }), active: status === "cancelled" },
  ] };

  return <div data-admin-compact-top className="space-y-4">
    <AdminPageToolbar compact sticky title="ประกาศส่วนกลาง" description="ส่งและจัดการประกาศสำคัญสำหรับสมาชิกในหมู่บ้าน" search={{ keyword: q, label: "ค้นหาประกาศ", placeholder: "ค้นหาหัวข้อหรือเนื้อหา" }} filters={<AdminFilterDropdown group={statusGroup} />} activeFilterCount={status === "all" ? 0 : 1} actions={<Link href="#create-broadcast" className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"><Plus className="h-4 w-4" aria-hidden="true" />สร้างประกาศ</Link>} />
    <details id="create-broadcast" open className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5">
      <summary className="cursor-pointer list-none text-sm font-semibold text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500">สร้างประกาศ</summary>
      <BroadcastComposer action={createAdminVillageBroadcastAction} />
    </details>
    <div className="flex flex-wrap items-center justify-between gap-2 px-1"><h2 className="text-sm font-semibold text-gray-800">รายการประกาศ</h2><p className="text-sm text-gray-500">พบ {total.toLocaleString("th-TH")} รายการ</p></div>
    {rows.length ? <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100" aria-label="ประวัติประกาศ"><div className="divide-y divide-gray-100">{rows.map((row) => {
      const state: BroadcastDisplayStatus = row.status === "CANCELLED" ? "CANCELLED" : row.expiresAt && row.expiresAt <= now ? "EXPIRED" : "ACTIVE";
      return <Link key={row.id} href={`/admin/broadcasts/${row.id}`} className="group block px-4 py-4 transition-colors hover:bg-gray-50/70 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-600 sm:px-5"><article><div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${broadcastStatusClassName(state)}`}>{broadcastStatusLabels[state]}</span><h3 className="min-w-0 break-words font-semibold text-gray-900 transition-colors group-hover:text-green-700">{row.title}</h3></div><p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">{row.body}</p></div><time className="shrink-0 text-xs text-gray-400 sm:pt-1" dateTime={row.createdAt.toISOString()}>สร้างเมื่อ {row.createdAt.toLocaleString("th-TH")}</time></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500"><span>ผู้รับ {row.audienceCount.toLocaleString("th-TH")} คน</span><span>{row.expiresAt ? `หมดอายุ ${broadcastExpiryLabel(row.expiresAt)}` : "ไม่กำหนดวันหมดอายุ"}</span></div></article></Link>;
    })}</div></section> : <section className="rounded-2xl bg-white px-5 py-12 text-center shadow-sm ring-1 ring-gray-100" aria-label="ไม่พบประกาศ"><Megaphone className="mx-auto h-10 w-10 text-green-600/70" aria-hidden="true" /><h2 className="mt-3 text-base font-semibold text-gray-900">{q || status !== "all" ? "ไม่พบประกาศตามเงื่อนไขที่เลือก" : "ยังไม่มีประกาศ"}</h2><p className="mt-1 text-sm text-gray-500">{q || status !== "all" ? "ลองเปลี่ยนคำค้นหาหรือสถานะ" : "เมื่อสร้างประกาศ รายการจะแสดงที่นี่"}</p></section>}
    {totalPages > 1 ? <nav className="flex flex-wrap items-center justify-center gap-2 pt-1" aria-label="การแบ่งหน้าประกาศ">{page > 1 ? <Link className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600" href={href({ q, status, page: page - 1 })}>ก่อนหน้า</Link> : <span className="cursor-not-allowed rounded-lg border border-gray-100 px-3 py-2 text-sm text-gray-300">ก่อนหน้า</span>}<span className="px-2 text-sm text-gray-500">หน้า {page} จาก {totalPages}</span>{page < totalPages ? <Link className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600" href={href({ q, status, page: page + 1 })}>ถัดไป</Link> : <span className="cursor-not-allowed rounded-lg border border-gray-100 px-3 py-2 text-sm text-gray-300">ถัดไป</span>}</nav> : null}
  </div>;
}

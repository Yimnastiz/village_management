import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { NotificationStatus } from "@prisma/client";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { requireVillagePagePermission } from "@/lib/admin-permission.server";
import { feedbackMetadataString, listFeedback, normalizeFeedbackPage, normalizeFeedbackStatus, type FeedbackStatusFilter } from "@/features/feedback/server/feedback-service";
import { FeedbackCategoryFilter } from "./category-filter";
import { categoryClassName, categoryLabel, statusLabels } from "./feedback-presentation";

const title = "ความคิดเห็นและข้อเสนอแนะ";
type Props = { searchParams?: Promise<{ q?: string; status?: string; category?: string; page?: string }> };

function href(values: { q: string; status: FeedbackStatusFilter; category: string; page?: number }) {
  const params = new URLSearchParams();
  if (values.q) params.set("q", values.q);
  if (values.status !== "active") params.set("status", values.status);
  if (values.category !== "all") params.set("category", values.category);
  if (values.page && values.page > 1) params.set("page", String(values.page));
  const query = params.toString();
  return query ? `/admin/feedback?${query}` : "/admin/feedback";
}

export default async function AdminFeedbackPage({ searchParams }: Props) {
  const context = await requireVillagePagePermission("feedback.manage", { callbackUrl: "/admin/feedback" });
  const params = await searchParams ?? {};
  const q = (params.q ?? "").trim();
  const status = normalizeFeedbackStatus(params.status);
  const category = ["suggestion", "complaint", "bug", "other"].includes(params.category ?? "") ? params.category! : "all";
  const data = await listFeedback({ q, status, category, page: normalizeFeedbackPage(params.page), villageId: context.villageId });
  const hasFilters = Boolean(q) || status !== "active" || category !== "all";

  return <div data-admin-compact-top className="space-y-3">
    <AdminPageToolbar compact sticky title={title} description="ตรวจสอบความคิดเห็นและข้อเสนอแนะจากผู้ใช้งาน" search={{ keyword: q, label: "ค้นหาความคิดเห็น", placeholder: "ค้นหาหัวข้อ รายละเอียด ชื่อ หรืออีเมล" }} filters={<div className="flex min-w-0 flex-wrap items-center gap-2"><nav className="flex min-w-0 max-w-full gap-1 overflow-x-auto pb-0.5" aria-label="สถานะความคิดเห็น">{(["active", "all", NotificationStatus.UNREAD, NotificationStatus.READ, NotificationStatus.ARCHIVED] as FeedbackStatusFilter[]).map((value) => <Link key={value} href={href({ q, category, status: value })} className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${status === value ? "bg-emerald-100 font-medium text-emerald-800" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`}>{value === "active" ? "กล่องขาเข้า" : value === "all" ? "ทั้งหมด" : statusLabels[value]}</Link>)}</nav><FeedbackCategoryFilter value={category} /></div>} activeFilterCount={(status === "active" ? 0 : 1) + (category === "all" ? 0 : 1)} />
    <div className="flex items-center justify-between gap-3 px-1"><p className="text-sm font-medium text-gray-700">พบ {data.total.toLocaleString("th-TH")} รายการ</p><span className="text-xs text-gray-400">ความคิดเห็นทั้งหมด</span></div>
    {data.rows.length ? <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm" aria-label="รายการความคิดเห็น"><div className="divide-y divide-gray-100">{data.rows.map((row) => {
      const name = feedbackMetadataString(row.metadata, "name"); const email = feedbackMetadataString(row.metadata, "email"); const categoryName = feedbackMetadataString(row.metadata, "category"); const unread = row.status === NotificationStatus.UNREAD; const archived = row.status === NotificationStatus.ARCHIVED;
      return <Link key={row.id} href={`/admin/feedback/${row.id}`} className={`group block px-4 py-4 transition-colors focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-600 sm:px-5 ${unread ? "bg-emerald-50/60 hover:bg-emerald-50" : archived ? "bg-gray-50/70 text-gray-500 hover:bg-gray-100/70" : "bg-white hover:bg-gray-50/70"}`}><article><div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryClassName(categoryName)}`}>{categoryLabel(categoryName)}</span>{unread ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden="true" />ยังไม่ได้อ่าน</span> : null}{archived ? <span className="text-xs text-gray-400">เก็บถาวร</span> : null}</div><h2 className={`mt-2 break-words text-base transition-colors group-hover:text-emerald-700 ${unread ? "font-semibold text-gray-950" : archived ? "font-medium text-gray-600" : "font-medium text-gray-900"}`}>{row.title}</h2></div><time className="shrink-0 text-xs text-gray-400 sm:pt-1" dateTime={row.createdAt.toISOString()}>{row.createdAt.toLocaleString("th-TH")}</time></div><p className="mt-1.5 line-clamp-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">{row.body || "ไม่มีรายละเอียด"}</p><p className="mt-2 break-words text-xs text-gray-500">{name || "ไม่ระบุชื่อ"}{email ? <> <span aria-hidden="true">·</span> <span className="break-all">{email}</span></> : null}</p></article></Link>;
    })}</div></section> : <div className="rounded-2xl bg-white px-5 py-10 text-center shadow-sm ring-1 ring-gray-100"><MessageSquareText className="mx-auto h-9 w-9 text-emerald-600/70" aria-hidden="true" /><h2 className="mt-3 text-base font-semibold text-gray-900">{hasFilters ? "ไม่พบความคิดเห็นตามเงื่อนไขที่เลือก" : "ยังไม่มีความคิดเห็นหรือข้อเสนอแนะ"}</h2><p className="mt-1 text-sm text-gray-500">{hasFilters ? "ลองเปลี่ยนคำค้นหา สถานะ หรือประเภทความคิดเห็น" : "เมื่อมีผู้ใช้งานส่งความคิดเห็น รายการจะแสดงที่นี่"}</p></div>}
    {data.totalPages > 1 ? <nav className="flex flex-wrap items-center justify-center gap-2 pt-1" aria-label="การแบ่งหน้า">{data.currentPage > 1 ? <Link className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600" href={href({ q, category, status, page: data.currentPage - 1 })}>ก่อนหน้า</Link> : <span className="cursor-not-allowed rounded-lg border border-gray-100 px-3 py-1.5 text-sm text-gray-300">ก่อนหน้า</span>}<span className="px-2 text-sm text-gray-500">หน้า {data.currentPage} จาก {data.totalPages}</span>{data.currentPage < data.totalPages ? <Link className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600" href={href({ q, category, status, page: data.currentPage + 1 })}>ถัดไป</Link> : <span className="cursor-not-allowed rounded-lg border border-gray-100 px-3 py-1.5 text-sm text-gray-300">ถัดไป</span>}</nav> : null}
  </div>;
}

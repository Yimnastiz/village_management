import Link from "next/link";
import { NotificationStatus } from "@prisma/client";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { requireVillagePagePermission } from "@/lib/admin-permission.server";
import { feedbackMetadataString, listFeedback, normalizeFeedbackPage, normalizeFeedbackStatus, type FeedbackStatusFilter } from "@/features/feedback/server/feedback-service";

const title = "ความคิดเห็นและข้อเสนอแนะ";
const statusLabels: Record<NotificationStatus, string> = { UNREAD: "ยังไม่ได้อ่าน", READ: "อ่านแล้ว", ARCHIVED: "เก็บถาวร" };
type Props = { searchParams?: Promise<{ q?: string; status?: string; category?: string; page?: string }> };

function href(values: { q: string; status: FeedbackStatusFilter; category: string; page?: number }) {
  const params = new URLSearchParams();
  if (values.q) params.set("q", values.q);
  if (values.status !== "active") params.set("status", values.status);
  if (values.category !== "all") params.set("category", values.category);
  if (values.page && values.page > 1) params.set("page", String(values.page));
  const query = params.toString(); return query ? `/admin/feedback?${query}` : "/admin/feedback";
}

export default async function AdminFeedbackPage({ searchParams }: Props) {
  const context = await requireVillagePagePermission("feedback.manage", { callbackUrl: "/admin/feedback" });
  const params = await searchParams ?? {};
  const q = (params.q ?? "").trim(); const status = normalizeFeedbackStatus(params.status);
  const category = ["suggestion", "complaint", "bug", "other"].includes(params.category ?? "") ? params.category! : "all";
  const data = await listFeedback({ q, status, category, page: normalizeFeedbackPage(params.page), villageId: context.villageId });
  return <div data-admin-compact-top className="space-y-3">
    <AdminPageToolbar compact sticky title={title} description="ตรวจสอบความคิดเห็นและข้อเสนอแนะจากผู้ใช้งาน" search={{ keyword: q, label: "ค้นหาความคิดเห็น", placeholder: "ค้นหาหัวข้อ รายละเอียด ชื่อ หรืออีเมล" }} filters={<nav className="flex flex-wrap gap-1" aria-label="สถานะความคิดเห็น">{(["active", "all", NotificationStatus.UNREAD, NotificationStatus.READ, NotificationStatus.ARCHIVED] as FeedbackStatusFilter[]).map((value) => <Link key={value} href={href({ q, category, status: value })} className={`rounded-md px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${status === value ? "bg-green-700 text-white" : "text-gray-700 hover:bg-gray-100"}`}>{value === "active" ? "กล่องขาเข้า" : value === "all" ? "ทั้งหมด" : statusLabels[value]}</Link>)}</nav>} activeFilterCount={status === "active" ? 0 : 1} />
    <p className="px-1 text-sm text-gray-600">พบ {data.total.toLocaleString("th-TH")} รายการ</p>
    {data.rows.length ? <div className="space-y-2">{data.rows.map((row) => { const name = feedbackMetadataString(row.metadata, "name"); const email = feedbackMetadataString(row.metadata, "email"); const categoryName = feedbackMetadataString(row.metadata, "category"); return <article key={row.id} className={`rounded-xl border p-4 shadow-sm ${row.status === NotificationStatus.UNREAD ? "border-green-200 bg-green-50/60" : "border-gray-200 bg-white"}`}><div className="flex flex-col gap-2 sm:flex-row sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{categoryName === "suggestion" ? "ข้อเสนอแนะ" : categoryName === "complaint" ? "ข้อร้องเรียน" : categoryName === "bug" ? "รายงานข้อผิดพลาด" : "อื่น ๆ"}</span><span className="rounded-full border px-2 py-0.5 text-xs text-gray-700">{statusLabels[row.status]}</span></div><Link href={`/admin/feedback/${row.id}`} className="mt-2 block break-words font-semibold text-gray-900 hover:text-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600">{row.title}</Link></div><time className="shrink-0 text-xs text-gray-500" dateTime={row.createdAt.toISOString()}>{row.createdAt.toLocaleString("th-TH")}</time></div><p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">{row.body || "ไม่มีรายละเอียด"}</p><p className="mt-3 break-words border-t pt-3 text-sm text-gray-600">ผู้ส่ง: <span className="font-medium text-gray-900">{name || "ไม่ระบุ"}</span>{email ? <> · <span className="break-all">{email}</span></> : null}</p></article>; })}</div> : <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm font-medium text-gray-700">{q || status !== "active" || category !== "all" ? "ไม่พบความคิดเห็นตามเงื่อนไขที่เลือก" : "ยังไม่มีความคิดเห็นหรือข้อเสนอแนะ"}</div>}
    {data.totalPages > 1 ? <nav className="flex flex-wrap justify-center gap-2" aria-label="การแบ่งหน้า"><Link className="rounded border px-3 py-1.5 text-sm" href={href({ q, category, status, page: Math.max(1, data.currentPage - 1) })}>ก่อนหน้า</Link><span className="px-3 py-1.5 text-sm">หน้า {data.currentPage} / {data.totalPages}</span><Link className="rounded border px-3 py-1.5 text-sm" href={href({ q, category, status, page: Math.min(data.totalPages, data.currentPage + 1) })}>ถัดไป</Link></nav> : null}
  </div>;
}

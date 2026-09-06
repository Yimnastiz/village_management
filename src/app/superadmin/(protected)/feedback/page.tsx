import { NotificationStatus, Prisma } from "@prisma/client";
import Link from "next/link";
import { AdminListToolbar, type ToolbarGroup } from "@/components/ui/admin-list-toolbar";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

const PAGE_SIZE = 20;
const FEEDBACK_SOURCE = "PUBLIC_FEEDBACK";
const FEEDBACK_CATEGORIES = ["suggestion", "complaint", "bug", "other"] as const;
const FEEDBACK_STATUSES = [NotificationStatus.UNREAD, NotificationStatus.READ, NotificationStatus.ARCHIVED] as const;
const CATEGORY_LABELS: Record<(typeof FEEDBACK_CATEGORIES)[number], string> = {
  suggestion: "ข้อเสนอแนะ",
  complaint: "ข้อร้องเรียน",
  bug: "รายงานข้อผิดพลาด",
  other: "อื่น ๆ",
};
const STATUS_LABELS: Record<NotificationStatus, string> = {
  UNREAD: "ยังไม่อ่าน",
  READ: "อ่านแล้ว",
  ARCHIVED: "เก็บถาวร",
};

type PageProps = { searchParams?: Promise<{ q?: string; category?: string; status?: string; sort?: string; page?: string }> };
type StatusFilter = "active" | "all" | NotificationStatus;
type FeedbackRow = { id: string; title: string; body: string | null; status: NotificationStatus; createdAt: Date; name: string | null; email: string | null; category: string | null };

function normalizeCategory(value: string | undefined) {
  return FEEDBACK_CATEGORIES.includes(value as (typeof FEEDBACK_CATEGORIES)[number]) ? value! : "all";
}

function normalizeStatus(value: string | undefined): StatusFilter {
  if (value === "active" || value === "all") return value;
  return FEEDBACK_STATUSES.includes(value as NotificationStatus) ? value as NotificationStatus : "active";
}

function normalizeSort(value: string | undefined) {
  return value === "oldest" ? "oldest" : "newest";
}

function normalizePage(value: string | undefined) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function metadataString(metadata: Prisma.JsonValue | null, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function queryHref(values: { q: string; category: string; status: StatusFilter; sort: string; page: number }) {
  const params = new URLSearchParams();
  if (values.q) params.set("q", values.q);
  if (values.category !== "all") params.set("category", values.category);
  if (values.status !== "active") params.set("status", values.status);
  if (values.sort !== "newest") params.set("sort", values.sort);
  if (values.page > 1) params.set("page", String(values.page));
  const query = params.toString();
  return query ? `/superadmin/feedback?${query}` : "/superadmin/feedback";
}

function badgeClass(kind: "unread" | "read" | "archived" | "category") {
  if (kind === "unread") return "border-amber-200 bg-amber-50 text-amber-800";
  if (kind === "read") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (kind === "archived") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-cyan-200 bg-cyan-50 text-cyan-800";
}

function StatusBadge({ status }: { status: NotificationStatus }) {
  const kind = status === NotificationStatus.UNREAD ? "unread" : status === NotificationStatus.READ ? "read" : "archived";
  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${badgeClass(kind)}`}>{STATUS_LABELS[status]}</span>;
}

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${badgeClass("category")}`}>{CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? "อื่น ๆ"}</span>;
}

export default async function SuperAdminFeedbackPage({ searchParams }: PageProps) {
  await requireSuperAdminPageSession();
  const params = (searchParams ? await searchParams : {}) ?? {};
  const keyword = (params.q ?? "").trim();
  const category = normalizeCategory(params.category);
  const status = normalizeStatus(params.status);
  const sort = normalizeSort(params.sort);
  const requestedPage = normalizePage(params.page);
  const keywordFilter: Prisma.NotificationWhereInput | undefined = keyword ? {
    OR: [
      { title: { contains: keyword, mode: "insensitive" } },
      { body: { contains: keyword, mode: "insensitive" } },
      { metadata: { path: ["name"], string_contains: keyword } },
      { metadata: { path: ["email"], string_contains: keyword } },
    ],
  } : undefined;
  const where: Prisma.NotificationWhereInput = {
    AND: [
      { metadata: { path: ["source"], equals: FEEDBACK_SOURCE } },
      ...(category !== "all" ? [{ metadata: { path: ["category"], equals: category } }] : []),
      ...(status === "active" ? [{ status: { in: [NotificationStatus.UNREAD, NotificationStatus.READ] } }] : status !== "all" ? [{ status }] : []),
      ...(keywordFilter ? [keywordFilter] : []),
    ],
  };
  const total = await prisma.notification.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const rows = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: { id: true, title: true, body: true, status: true, createdAt: true, metadata: true },
  });
  const feedbackRows: FeedbackRow[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status,
    createdAt: row.createdAt,
    name: metadataString(row.metadata, "name"),
    email: metadataString(row.metadata, "email"),
    category: metadataString(row.metadata, "category"),
  }));
  const base = { q: keyword, category, status, sort };
  const filtered = Boolean(keyword || category !== "all" || status !== "active" || sort !== "newest");
  const groups: ToolbarGroup[] = [
    { label: "หมวดหมู่", options: [{ label: "ทั้งหมด", href: queryHref({ ...base, category: "all", page: 1 }), active: category === "all", isDefault: true }, ...FEEDBACK_CATEGORIES.map((value) => ({ label: CATEGORY_LABELS[value], href: queryHref({ ...base, category: value, page: 1 }), active: category === value }))] },
    { label: "สถานะ", options: [{ label: "กล่องขาเข้า", href: queryHref({ ...base, status: "active", page: 1 }), active: status === "active", isDefault: true }, { label: "ทั้งหมด", href: queryHref({ ...base, status: "all", page: 1 }), active: status === "all" }, ...FEEDBACK_STATUSES.map((value) => ({ label: STATUS_LABELS[value], href: queryHref({ ...base, status: value, page: 1 }), active: status === value }))] },
    { label: "เรียงลำดับ", countsAsFilter: false, options: [{ label: "ล่าสุดก่อน", href: queryHref({ ...base, sort: "newest", page: 1 }), active: sort === "newest", isDefault: true }, { label: "เก่าสุดก่อน", href: queryHref({ ...base, sort: "oldest", page: 1 }), active: sort === "oldest" }] },
  ];

  return (
    <div className="workspace-list-page -mt-4 mx-auto flex min-h-0 w-full max-w-[1500px] flex-col space-y-4 sm:-mt-6 sm:overflow-visible">
      <SuperAdminPageHeaderRegistration context={{ title: "ความคิดเห็นและข้อเสนอแนะ", description: "ตรวจสอบข้อเสนอแนะ การร้องเรียน และรายงานปัญหาที่ส่งเข้ามาจากผู้ใช้งาน" }} />
      <AdminListToolbar compact sticky hideHeading title="ความคิดเห็นและข้อเสนอแนะ" description="" searchAction="/superadmin/feedback" clearHref="/superadmin/feedback" keyword={keyword} searchLabel="ค้นหาความคิดเห็น" searchPlaceholder="ค้นหาหัวข้อ รายละเอียด ชื่อ หรืออีเมล" hiddenInputs={{ category: category === "all" ? "" : category, status: status === "active" ? "" : status, sort: sort === "newest" ? "" : sort }} groups={groups} />
      <section className="space-y-3" aria-label="รายการความคิดเห็นและข้อเสนอแนะ">
        <p className="px-1 text-sm text-slate-600">พบ {total.toLocaleString("th-TH")} รายการ</p>
        {feedbackRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-medium text-slate-700">{filtered ? "ไม่พบความคิดเห็นตามเงื่อนไขที่เลือก" : "ยังไม่มีความคิดเห็นและข้อเสนอแนะ"}</p>
            {filtered ? <p className="mt-1 text-sm text-slate-500">ลองปรับคำค้นหาหรือตัวกรอง แล้วตรวจสอบอีกครั้ง</p> : null}
          </div>
        ) : (
          <div className="space-y-2">
            {feedbackRows.map((row) => (
              <article key={row.id} className={`rounded-xl border bg-white p-4 shadow-sm transition sm:p-5 ${row.status === NotificationStatus.UNREAD ? "border-cyan-200" : "border-slate-200"}`}>
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5"><CategoryBadge category={row.category} /><StatusBadge status={row.status} /></div>
                    <Link href={`/superadmin/feedback/${row.id}`} className={`mt-2 block break-words text-base text-slate-900 hover:text-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 ${row.status === NotificationStatus.UNREAD ? "font-bold" : "font-semibold"}`}>{row.title}</Link>
                  </div>
                  <time dateTime={row.createdAt.toISOString()} className="shrink-0 text-xs text-slate-500">{row.createdAt.toLocaleString("th-TH")}</time>
                </div>
                <p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{row.body || "ไม่พบรายละเอียด"}</p>
                <div className="mt-3 grid gap-1 border-t border-slate-100 pt-3 text-sm text-slate-600 sm:grid-cols-2">
                  <p>ผู้ส่ง: <span className="font-medium text-slate-900">{row.name || "ไม่ระบุ"}</span></p>
                  <p>อีเมล: <span className="break-all font-medium text-slate-900">{row.email || "ไม่ระบุ"}</span></p>
                </div>
                <div className="mt-3"><Link href={`/superadmin/feedback/${row.id}`} aria-label={`ดูรายละเอียดความคิดเห็น: ${row.title}`} className="inline-flex min-h-9 items-center rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-1">ดูรายละเอียด</Link></div>
              </article>
            ))}
          </div>
        )}
        {totalPages > 1 ? <nav className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-200 px-1 pt-3" aria-label="การแบ่งหน้า"><Link href={queryHref({ ...base, page: Math.max(1, currentPage - 1) })} aria-disabled={currentPage <= 1} className={`rounded-md border px-3 py-1.5 text-sm ${currentPage <= 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>ก่อนหน้า</Link><span className="text-sm text-slate-600">หน้า {currentPage} / {totalPages}</span><Link href={queryHref({ ...base, page: Math.min(totalPages, currentPage + 1) })} aria-disabled={currentPage >= totalPages} className={`rounded-md border px-3 py-1.5 text-sm ${currentPage >= totalPages ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>ถัดไป</Link></nav> : null}
      </section>
    </div>
  );
}

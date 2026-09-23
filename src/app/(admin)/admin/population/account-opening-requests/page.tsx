import Link from "next/link";
import { HouseAccountOpeningRequestStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { Badge } from "@/components/ui/badge";
import { RequestViewTabs } from "@/components/ui/request-view-tabs";
import { requireVillagePagePermission } from "@/lib/admin-permission.server";
import {
  getOpeningRequestsForHeadman,
  HOUSE_ACCOUNT_OPENING_HISTORY_STATUSES,
} from "@/lib/house-account-opening-review-service";

const statusLabel: Record<HouseAccountOpeningRequestStatus, string> = {
  PENDING_EMAIL_VERIFICATION: "รอยืนยันอีเมล",
  PENDING_REVIEW: "รอตรวจสอบ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ปฏิเสธ",
  CANCELLED: "ยกเลิก",
  EXPIRED: "หมดอายุ",
};

function statusVariant(status: HouseAccountOpeningRequestStatus) {
  if (status === "APPROVED") return "success" as const;
  if (status === "REJECTED") return "danger" as const;
  if (status === "PENDING_REVIEW") return "warning" as const;
  return "outline" as const;
}

function formatDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(value)
    : "-";
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; status?: string; page?: string }>;
}) {
  const context = await requireVillagePagePermission("binding.review", {
    callbackUrl: "/admin/population/account-opening-requests",
    forbiddenRedirect: "/admin/population",
  });
  const params = await searchParams;
  const tab = params.tab === "history" ? "history" : "pending";
  const query = params.q?.trim() ?? "";
  const selectedStatus = HOUSE_ACCOUNT_OPENING_HISTORY_STATUSES.includes(
    params.status as (typeof HOUSE_ACCOUNT_OPENING_HISTORY_STATUSES)[number],
  ) ? params.status as (typeof HOUSE_ACCOUNT_OPENING_HISTORY_STATUSES)[number] : undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const result = await getOpeningRequestsForHeadman(context.session.id, {
    tab,
    query,
    historyStatus: selectedStatus,
    page,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  if (page > totalPages && result.total > 0) redirect("/admin/population/account-opening-requests");
  const href = (next: Record<string, string | undefined>) => {
    const values = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) if (value) values.set(key, value);
    return `/admin/population/account-opening-requests${values.size ? `?${values}` : ""}`;
  };
  const tabs = <RequestViewTabs label="สถานะคำขอ" tabs={[
    { href: href({ tab: "pending" }), label: "รอตรวจสอบ", active: tab === "pending", count: result.pendingCount },
    { href: href({ tab: "history" }), label: "ประวัติ", active: tab === "history" },
  ]} />;

  return <div data-admin-compact-top className="space-y-3">
    <AdminListToolbar
      sticky
      title="คำขอเปิดบัญชีบ้าน"
      description="ตรวจสอบคำขอเปิดบัญชีบ้านที่ยืนยันอีเมลแล้ว"
      actions={tabs}
      searchAction="/admin/population/account-opening-requests"
      keyword={query}
      searchPlaceholder="ค้นหาบ้าน ชื่อผู้ขอ หรือเบอร์โทร"
      hiddenInputs={{ tab, status: selectedStatus ?? "" }}
    />
    {tab === "history" ? <div className="flex flex-wrap gap-2" aria-label="กรองสถานะประวัติ">
      <Link href={href({ tab, q: query })} className={`rounded-full px-3 py-1.5 text-sm ${!selectedStatus ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>ทั้งหมด</Link>
      {HOUSE_ACCOUNT_OPENING_HISTORY_STATUSES.map((status) => <Link key={status} href={href({ tab, q: query, status })} className={`rounded-full px-3 py-1.5 text-sm ${selectedStatus === status ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{statusLabel[status]}</Link>)}
    </div> : null}
    <section className="space-y-2">
      {result.requests.map((request) => <Link key={request.id} href={`/admin/population/account-opening-requests/${request.id}`} className="block overflow-hidden rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="break-all font-semibold text-slate-900">บ้านเลขที่ {request.houseNumber}</p>
            <p className="mt-1 break-words text-sm text-slate-700">{request.applicantName}</p>
            <p className="mt-1 break-all text-sm text-slate-500">{request.maskedPhone} · {request.maskedEmail}</p>
            <p className="mt-2 text-xs text-slate-500">{tab === "pending" ? "ส่งคำขอ" : "ดำเนินการ"} {formatDate(tab === "pending" ? request.requestedAt : request.reviewedAt)}</p>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
            <Badge variant={statusVariant(request.status)}>{statusLabel[request.status]}</Badge>
            <span className="text-sm font-medium text-blue-700">ดูรายละเอียด →</span>
          </div>
        </div>
      </Link>)}
      {!result.requests.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-500">ไม่พบคำขอตามเงื่อนไข</div> : null}
    </section>
    {totalPages > 1 ? <nav className="flex items-center justify-between text-sm" aria-label="หน้ารายการคำขอ">
      <Link className={`rounded-lg border px-3 py-2 ${page === 1 ? "pointer-events-none opacity-40" : "hover:bg-white"}`} href={href({ tab, q: query, status: selectedStatus, page: String(page - 1) })}>ก่อนหน้า</Link>
      <span className="text-slate-500">หน้า {page} จาก {totalPages}</span>
      <Link className={`rounded-lg border px-3 py-2 ${page === totalPages ? "pointer-events-none opacity-40" : "hover:bg-white"}`} href={href({ tab, q: query, status: selectedStatus, page: String(page + 1) })}>ถัดไป</Link>
    </nav> : null}
  </div>;
}

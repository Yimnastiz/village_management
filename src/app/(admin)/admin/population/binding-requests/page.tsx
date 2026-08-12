import Link from "next/link";
import { BindingRequestStatus, MembershipStatus, Prisma, VillageMembershipRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { Badge } from "@/components/ui/badge";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { maskPhone } from "@/features/village-workspace/server/queries";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;
const historyStatuses = [BindingRequestStatus.APPROVED, BindingRequestStatus.REJECTED, BindingRequestStatus.CANCELLED] as const;
const statusLabel: Record<(typeof historyStatuses)[number], string> = { APPROVED: "อนุมัติแล้ว", REJECTED: "ปฏิเสธ", CANCELLED: "ยกเลิก" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; status?: string; page?: string }> }) {
  const session = await getSessionContextFromServerCookies();
  if (!session || !isAdminUser(session)) redirect("/admin/population");
  const params = await searchParams;
  const villageIds = session.memberships.filter((item) => item.status === MembershipStatus.ACTIVE && item.role !== VillageMembershipRole.RESIDENT).map((item) => item.villageId);
  const tab = params.tab === "history" ? "history" : "pending";
  const q = params.q?.trim() ?? "";
  const selectedStatus = historyStatuses.includes(params.status as (typeof historyStatuses)[number]) ? params.status as (typeof historyStatuses)[number] : undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const status = tab === "pending" ? BindingRequestStatus.PENDING : selectedStatus ? selectedStatus : { in: [...historyStatuses] };
  const where: Prisma.BindingRequestWhereInput = {
    villageId: { in: villageIds }, status,
    ...(q ? { OR: [
      { user: { is: { name: { contains: q, mode: "insensitive" } } } },
      { user: { is: { phoneNumber: { contains: q, mode: "insensitive" } } } },
      { houseNumber: { contains: q, mode: "insensitive" } },
      { house: { is: { houseNumber: { contains: q, mode: "insensitive" } } } },
    ] } : {}),
  };
  const [pendingCount, total, requests] = await Promise.all([
    prisma.bindingRequest.count({ where: { villageId: { in: villageIds }, status: BindingRequestStatus.PENDING } }),
    prisma.bindingRequest.count({ where }),
    prisma.bindingRequest.findMany({ where, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, orderBy: tab === "pending" ? { createdAt: "asc" } : { reviewedAt: "desc" }, include: { user: { select: { name: true, phoneNumber: true } }, house: { select: { houseNumber: true } } } }),
  ]);
  const reviewerIds = requests.map((request) => request.reviewedBy).filter((id): id is string => Boolean(id));
  const reviewers = reviewerIds.length ? await prisma.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, name: true } }) : [];
  const reviewerName = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer.name]));
  const query = (next: Record<string, string | undefined>) => {
    const qs = new URLSearchParams(); Object.entries(next).forEach(([key, value]) => { if (value) qs.set(key, value); });
    return `/admin/population/binding-requests${qs.size ? `?${qs}` : ""}`;
  };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return <div className="space-y-5">
    <AdminListToolbar title="คำขอผูกเลขบ้าน" description="ตรวจสอบและจัดการคำขอผูกบัญชีกับทะเบียนบ้าน" searchAction="/admin/population/binding-requests" keyword={q} searchPlaceholder="ค้นหาชื่อ เบอร์โทร หรือบ้านเลขที่" hiddenInputs={{ tab, status: selectedStatus ?? "" }} />
    <nav className="flex w-full gap-1 rounded-lg border border-gray-200 bg-white p-1 sm:w-fit" aria-label="สถานะคำขอ">
      <Link href={query({ tab: "pending" })} className={`min-h-10 flex-1 rounded-md px-3 py-2 text-center text-sm font-medium sm:flex-none ${tab === "pending" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>รอพิจารณา{pendingCount > 0 ? <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white">{pendingCount > 99 ? "99+" : pendingCount}</span> : null}</Link>
      <Link href={query({ tab: "history" })} className={`min-h-10 flex-1 rounded-md px-3 py-2 text-center text-sm font-medium sm:flex-none ${tab === "history" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>ประวัติ</Link>
    </nav>
    {tab === "history" ? <div className="flex flex-wrap gap-2" aria-label="กรองสถานะประวัติ">
      <Link href={query({ tab, q })} className={`rounded-full px-3 py-1.5 text-sm ${!selectedStatus ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>ทั้งหมด</Link>
      {historyStatuses.map((value) => <Link key={value} href={query({ tab, q, status: value })} className={`rounded-full px-3 py-1.5 text-sm ${selectedStatus === value ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{statusLabel[value]}</Link>)}
    </div> : null}
    <section className="space-y-2">
      {requests.map((request) => <Link key={request.id} href={`/admin/population/binding-requests/${request.id}`} className="block rounded-xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="font-semibold text-gray-900">{request.user.name}</p><p className="mt-1 text-sm text-gray-600">{maskPhone(request.user.phoneNumber)} · บ้านเลขที่ {request.houseNumber ?? request.house?.houseNumber ?? "-"}</p>
          {tab === "pending" ? <div className="mt-2 flex flex-wrap gap-2">{!request.houseId ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">ต้องตรวจสอบบ้านเพิ่ม</span> : null}</div> : <p className="mt-2 text-xs text-gray-500">ผู้พิจารณา {request.reviewedBy ? reviewerName.get(request.reviewedBy) ?? "-" : "-"} · {request.reviewedAt?.toLocaleString("th-TH") ?? "-"}{request.reviewNote ? ` · ${request.reviewNote}` : ""}</p>}</div>
          <div className="flex items-center gap-3"><Badge variant={request.status === "APPROVED" ? "success" : request.status === "REJECTED" ? "danger" : request.status === "CANCELLED" ? "outline" : "warning"}>{tab === "pending" ? "รอพิจารณา" : statusLabel[request.status as (typeof historyStatuses)[number]]}</Badge><span className="text-sm font-medium text-blue-700">ดูรายละเอียด →</span></div></div>
      </Link>)}
      {!requests.length ? <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-12 text-center text-sm text-gray-500">ไม่พบคำขอตามเงื่อนไข</div> : null}
    </section>
    {totalPages > 1 ? <nav className="flex items-center justify-between text-sm"><Link className={`rounded-lg border px-3 py-2 ${page === 1 ? "pointer-events-none opacity-40" : "hover:bg-white"}`} href={query({ tab, q, status: selectedStatus, page: String(page - 1) })}>ก่อนหน้า</Link><span className="text-gray-500">หน้า {page} จาก {totalPages}</span><Link className={`rounded-lg border px-3 py-2 ${page === totalPages ? "pointer-events-none opacity-40" : "hover:bg-white"}`} href={query({ tab, q, status: selectedStatus, page: String(page + 1) })}>ถัดไป</Link></nav> : null}
  </div>;
}

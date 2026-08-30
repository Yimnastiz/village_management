import Link from "next/link";
import { BindingRequestStatus, Prisma, SystemRole, VillageMembershipRole } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { QueryPagination } from "@/components/ui/query-pagination";
import { RequestViewTabs } from "@/components/ui/request-view-tabs";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { BINDING_REQUEST_STATUS_LABELS, MEMBERSHIP_ROLE_LABELS } from "@/lib/constants";
import { getWorkspaceVillage } from "@/features/village-workspace/server/queries";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { WorkspaceListPage } from "../workspace-list-page";

const PAGE_SIZE = 20;
const historyStatuses = [BindingRequestStatus.APPROVED, BindingRequestStatus.REJECTED, BindingRequestStatus.CANCELLED] as const;

function statusVariant(status: BindingRequestStatus): "success" | "danger" | "outline" | "warning" {
  if (status === BindingRequestStatus.APPROVED) return "success";
  if (status === BindingRequestStatus.REJECTED) return "danger";
  if (status === BindingRequestStatus.CANCELLED) return "outline";
  return "warning";
}

function reviewerRoleLabel(reviewer: { systemRole: SystemRole; memberships: { role: VillageMembershipRole }[] } | undefined) {
  if (!reviewer) return "-";
  if (reviewer.systemRole === SystemRole.SUPERADMIN) return "ผู้ดูแลระบบระดับสูง";
  return reviewer.memberships[0] ? MEMBERSHIP_ROLE_LABELS[reviewer.memberships[0].role] : "ผู้ดูแลหมู่บ้าน";
}

export default async function Page({ params, searchParams }: { params: Promise<{ villageId: string }>; searchParams: Promise<{ tab?: string; q?: string; status?: string; page?: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId } = await params;
  const search = await searchParams;
  const village = await getWorkspaceVillage(villageId);
  const base = `/superadmin/villages/${villageId}/binding-requests`;
  const tab = search.tab === "history" ? "history" : "pending";
  const keyword = search.q?.trim() ?? "";
  const selectedStatus = historyStatuses.includes(search.status as (typeof historyStatuses)[number]) ? search.status as (typeof historyStatuses)[number] : undefined;
  const page = Math.max(1, Number(search.page ?? "1") || 1);
  const status = tab === "pending" ? BindingRequestStatus.PENDING : selectedStatus ?? { in: [...historyStatuses] };
  const where: Prisma.BindingRequestWhereInput = {
    villageId,
    status,
    ...(keyword ? { OR: [
      { user: { is: { name: { contains: keyword, mode: "insensitive" } } } },
      { user: { is: { phoneNumber: { contains: keyword, mode: "insensitive" } } } },
      { houseNumber: { contains: keyword, mode: "insensitive" } },
      { house: { is: { villageId, houseNumber: { contains: keyword, mode: "insensitive" } } } },
    ] } : {}),
  };
  const [pendingCount, total, requests] = await Promise.all([
    prisma.bindingRequest.count({ where: { villageId, status: BindingRequestStatus.PENDING } }),
    prisma.bindingRequest.count({ where }),
    prisma.bindingRequest.findMany({ where, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, orderBy: { createdAt: tab === "pending" ? "asc" : "desc" }, include: { user: { select: { name: true, phoneNumber: true } }, house: { select: { houseNumber: true, villageId: true } } } }),
  ]);
  const reviewerIds = requests.map((request) => request.reviewedBy).filter((id): id is string => Boolean(id));
  const reviewers = reviewerIds.length ? await prisma.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, name: true, systemRole: true, memberships: { where: { villageId }, select: { role: true }, take: 1 } } }) : [];
  const reviewerById = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer]));
  const query = (next: { tab?: typeof tab; q?: string; status?: (typeof historyStatuses)[number]; page?: string }) => {
    const params = new URLSearchParams();
    const nextTab = next.tab ?? tab;
    const nextQuery = next.q ?? keyword;
    if (nextTab === "history") params.set("tab", "history");
    if (nextQuery) params.set("q", nextQuery);
    if (nextTab === "history" && next.status) params.set("status", next.status);
    if (next.page && next.page !== "1") params.set("page", next.page);
    const value = params.toString();
    return value ? `${base}?${value}` : base;
  };
  const requestTabs = <RequestViewTabs label="มุมมองคำขอผูกบ้าน" tabs={[
    { href: query({ tab: "pending", q: keyword }), label: "รอพิจารณา", active: tab === "pending", count: pendingCount },
    { href: query({ tab: "history", q: keyword, status: selectedStatus }), label: "ประวัติ", active: tab === "history" },
  ]} />;
  const requestedHouse = (request: typeof requests[number]) => request.houseNumber ?? request.house?.houseNumber ?? "-";
  const missingHouse = (request: typeof requests[number]) => !request.house || request.house.villageId !== villageId;

  return <WorkspaceListPage><div className="flex min-h-0 flex-col sm:h-[calc(100dvh-var(--app-topbar-visible-offset,4rem)-2rem)] sm:overflow-visible">
    <SuperAdminPageHeaderRegistration priority={1} context={{ title: "คำขอผูกเลขบ้าน", description: `${village.name} · ${total.toLocaleString("th-TH")} รายการ` }} />
    <AdminListToolbar sticky hideHeading title="คำขอผูกเลขบ้าน" description={`ตรวจสอบและจัดการคำขอของ ${village.name}`} actions={requestTabs} searchAction={base} clearHref={query({ tab, q: "" })} keyword={keyword} searchLabel="ค้นหาคำขอผูกบ้าน" searchPlaceholder="ค้นหาชื่อ เบอร์โทร หรือบ้านเลขที่" groups={tab === "history" ? [{ label: "สถานะ", options: [
      { label: "ทั้งหมด", href: query({ tab, q: keyword }), active: !selectedStatus, isDefault: true },
      ...historyStatuses.map((value) => ({ label: BINDING_REQUEST_STATUS_LABELS[value], href: query({ tab, q: keyword, status: value }), active: selectedStatus === value })),
    ] }] : []} />
    <section className={`mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white ${requests.length ? "" : "items-center justify-center"}`}>
      {requests.length ? <>
        <div className="divide-y divide-gray-100 md:hidden">{requests.map((request) => { const reviewer = request.reviewedBy ? reviewerById.get(request.reviewedBy) : undefined; return <Link key={request.id} href={`${base}/${request.id}`} className="block p-4 transition-colors hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-500"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-gray-900">{request.user.name}</p><p className="mt-1 text-sm text-gray-600">{request.user.phoneNumber}</p></div><Badge variant={statusVariant(request.status)}>{BINDING_REQUEST_STATUS_LABELS[request.status]}</Badge></div><p className="mt-3 text-sm text-gray-700">บ้านเลขที่ {requestedHouse(request)}</p>{missingHouse(request) ? <p className="mt-2 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">ต้องตรวจสอบบ้านเพิ่ม</p> : null}<p className="mt-3 text-xs text-gray-500">ยื่นเมื่อ {request.createdAt.toLocaleString("th-TH")}</p>{tab === "history" ? <p className="mt-1 text-xs text-gray-500">ผู้พิจารณา {reviewer?.name ?? "-"} ({reviewerRoleLabel(reviewer)}) · {request.reviewedAt?.toLocaleString("th-TH") ?? "-"}</p> : null}</Link>})}</div>
        <div className="hidden min-h-0 flex-1 overflow-auto md:block"><table className="min-w-[900px] w-full text-sm"><thead className="sticky top-0 z-20 bg-gray-50 text-left text-gray-600 shadow-sm"><tr><th scope="col" className="bg-gray-50 px-4 py-3">ผู้ยื่นคำขอ</th><th scope="col" className="bg-gray-50 px-4 py-3">เบอร์โทร</th><th scope="col" className="bg-gray-50 px-4 py-3">บ้านเลขที่ที่ขอ</th><th scope="col" className="whitespace-nowrap bg-gray-50 px-4 py-3">วันที่ยื่น</th>{tab === "history" ? <th scope="col" className="whitespace-nowrap bg-gray-50 px-4 py-3">ผู้พิจารณา / วันที่พิจารณา</th> : null}<th scope="col" className="whitespace-nowrap bg-gray-50 px-4 py-3">สถานะ</th><th scope="col" className="whitespace-nowrap bg-gray-50 px-4 py-3">การจัดการ</th></tr></thead><tbody>{requests.map((request) => { const reviewer = request.reviewedBy ? reviewerById.get(request.reviewedBy) : undefined; return <tr key={request.id} className="border-t border-gray-100 transition-colors hover:bg-blue-50/60 focus-within:bg-blue-50/60"><td className="px-4 py-3 font-medium text-gray-900">{request.user.name}</td><td className="px-4 py-3 text-gray-700">{request.user.phoneNumber}</td><td className="px-4 py-3 text-gray-700"><p>{requestedHouse(request)}</p>{missingHouse(request) ? <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">ต้องตรวจสอบบ้านเพิ่ม</span> : null}</td><td className="whitespace-nowrap px-4 py-3 text-gray-700">{request.createdAt.toLocaleString("th-TH")}</td>{tab === "history" ? <td className="px-4 py-3 text-gray-700"><p>{reviewer?.name ?? "-"}</p><p className="mt-0.5 text-xs text-gray-500">{reviewerRoleLabel(reviewer)} · {request.reviewedAt?.toLocaleString("th-TH") ?? "-"}</p></td> : null}<td className="px-4 py-3"><Badge variant={statusVariant(request.status)}>{BINDING_REQUEST_STATUS_LABELS[request.status]}</Badge></td><td className="px-4 py-3"><Link href={`${base}/${request.id}`} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2">ดูรายละเอียด</Link></td></tr>})}</tbody></table></div>
      </> : <div className="px-4 py-10 text-center text-sm text-gray-500"><p className="font-medium text-gray-700">ไม่พบคำขอผูกบ้าน</p><p className="mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรอง แล้วตรวจสอบอีกครั้ง</p></div>}
    </section>
    <QueryPagination pathname={base} page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} params={{ tab: tab === "history" ? "history" : undefined, q: keyword || undefined, status: selectedStatus }} />
  </div></WorkspaceListPage>;
}

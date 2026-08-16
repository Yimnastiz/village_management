import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { AlertCircle, Plus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { ISSUE_CATEGORY_LABELS, ISSUE_PRIORITY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { QueryPagination } from "@/components/ui/query-pagination";
import { getUserDisplayName } from "@/lib/user-display";
import { IssueStatusIndicator } from "@/components/issues/issue-status-indicator";
import { ISSUE_STATUS_META } from "@/lib/issues/status";

interface PageProps {
  searchParams: Promise<{ q?: string; stage?: string; category?: string; sort?: string; page?: string }>;
}

const priorityBorderColor: Record<string, string> = {
  URGENT: "border-l-red-500",
  HIGH: "border-l-orange-600",
  MEDIUM: "border-l-yellow-400",
  LOW: "border-l-emerald-600",
};

const priorityBadgeClass: Record<string, string> = {
  URGENT: "bg-red-100 text-red-700",
  HIGH: "bg-orange-100 text-orange-900",
  MEDIUM: "bg-yellow-100 text-yellow-900",
  LOW: "bg-emerald-100 text-emerald-900",
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

export default async function AdminIssuesPage({ searchParams }: PageProps) {
  const { q, stage, category, sort, page: pageParam } = await searchParams;
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
  });
  if (!membership) redirect("/auth/login");

  const keyword = q?.trim() ?? "";
  const activeStage = stage === "OPEN" || stage === "WAITING" ? "PENDING" : stage === "CLOSED" ? "RESOLVED" : stage ?? "ALL";
  const activeCategory = category ?? "ALL";
  const activeSort = sort ?? "newest";
  const page = Math.max(1, Number(pageParam ?? "1") || 1);
  const pageSize = 25;

  const whereClause: Prisma.IssueWhereInput = { villageId: membership.villageId };
  if (activeStage === "PENDING") whereClause.stage = { in: ["OPEN", "WAITING"] };
  else if (activeStage === "RESOLVED") whereClause.stage = { in: ["RESOLVED", "CLOSED"] };
  else if (activeStage !== "ALL") whereClause.stage = activeStage as Prisma.IssueWhereInput["stage"];
  if (activeCategory !== "ALL") whereClause.category = activeCategory as Prisma.IssueWhereInput["category"];
  if (keyword) {
    const matchingReporters = await prisma.user.findMany({
      where: {
        memberships: { some: { villageId: membership.villageId, status: "ACTIVE" } },
        OR: [{ name: { contains: keyword, mode: "insensitive" } }, { phoneNumber: { contains: keyword } }],
      },
      select: { id: true },
    });
    whereClause.OR = [
      { title: { contains: keyword, mode: "insensitive" } },
      { location: { contains: keyword, mode: "insensitive" } },
      { description: { contains: keyword, mode: "insensitive" } },
      ...(matchingReporters.length ? [{ reporterId: { in: matchingReporters.map((user) => user.id) } }] : []),
    ];
  }

  const orderBy =
    activeSort === "oldest"
      ? [{ createdAt: "asc" as const }]
      : activeSort === "priority"
        ? [{ priority: "desc" as const }, { createdAt: "desc" as const }]
        : [{ createdAt: "desc" as const }];

  const [issues, filteredCount, stageCounts] = await Promise.all([
    prisma.issue.findMany({
      where: whereClause,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        reporterId: true,
        title: true,
        category: true,
        priority: true,
        stage: true,
        createdAt: true,
        location: true,
      },
    }),
    prisma.issue.count({ where: whereClause }),
    prisma.issue.groupBy({
      by: ["stage"],
      where: { villageId: membership.villageId },
      _count: true,
    }),
  ]);

  const counts: Record<string, number> = {};
  const reporters = await prisma.user.findMany({
    where: { id: { in: Array.from(new Set(issues.map((issue) => issue.reporterId))) } },
    select: { id: true, name: true, phoneNumber: true },
  });
  const reporterById = new Map(reporters.map((reporter) => [reporter.id, reporter]));
  for (const c of stageCounts) counts[c.stage] = c._count;
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));

  const pendingCount = (counts.OPEN ?? 0) + (counts.WAITING ?? 0);
  const resolvedCount = (counts.RESOLVED ?? 0) + (counts.CLOSED ?? 0);
  const stageFilters = [
    { value: "ALL", label: "ทั้งหมด", count: totalCount },
    { value: "PENDING", label: ISSUE_STATUS_META.PENDING.label, count: pendingCount },
    { value: "IN_PROGRESS", label: ISSUE_STATUS_META.IN_PROGRESS.label },
    { value: "RESOLVED", label: ISSUE_STATUS_META.RESOLVED.label, count: resolvedCount },
    { value: "REJECTED", label: ISSUE_STATUS_META.REJECTED.label },
  ];

  const suggestionTitles = Array.from(new Set(issues.map((issue) => issue.title))).slice(0, 12);

  function buildIssuesHref(next: { q?: string; stage?: string; category?: string; sort?: string }) {
    const query = new URLSearchParams();
    const qValue = next.q?.trim() ?? "";
    const stageValue = next.stage ?? "ALL";
    const categoryValue = next.category ?? "ALL";
    const sortValue = next.sort ?? "newest";

    if (qValue) query.set("q", qValue);
    if (stageValue !== "ALL") query.set("stage", stageValue);
    if (categoryValue !== "ALL") query.set("category", categoryValue);
    if (sortValue !== "newest") query.set("sort", sortValue);

    const queryString = query.toString();
    return queryString ? `/admin/issues?${queryString}` : "/admin/issues";
  }

  return (
    <div className="space-y-6">
      <AdminListToolbar
        title="จัดการปัญหา/คำร้อง"
        description={`รอดำเนินการ ${pendingCount} • กำลังดำเนินการ ${counts["IN_PROGRESS"] ?? 0} • แก้ไขแล้ว ${resolvedCount}`}
        searchAction="/admin/issues"
        keyword={keyword}
        searchPlaceholder="ค้นหาหัวข้อ ผู้แจ้ง เบอร์โทร หรือรายละเอียด"
        hiddenInputs={{ stage: activeStage === "ALL" ? "" : activeStage, category: activeCategory === "ALL" ? "" : activeCategory, sort: activeSort === "newest" ? "" : activeSort }}
        suggestionTitles={suggestionTitles}
        groups={[
          {
            label: "สถานะ",
            options: stageFilters.map((filter) => ({
              label: `${filter.label}${(filter.count ?? counts[filter.value] ?? 0) > 0 ? ` (${filter.count ?? counts[filter.value]})` : ""}`,
              href: buildIssuesHref({ q: keyword, stage: filter.value, category: activeCategory, sort: activeSort }),
              active: activeStage === filter.value,
            })),
          },
          {
            label: "หมวด",
            options: [
              { label: "ทั้งหมด", href: buildIssuesHref({ q: keyword, stage: activeStage, category: "ALL", sort: activeSort }), active: activeCategory === "ALL" },
              ...Object.entries(ISSUE_CATEGORY_LABELS).map(([value, label]) => ({
                label,
                href: buildIssuesHref({ q: keyword, stage: activeStage, category: value, sort: activeSort }),
                active: activeCategory === value,
              })),
            ],
          },
          {
            label: "เรียง",
            options: [
              { label: "ล่าสุดก่อน", href: buildIssuesHref({ q: keyword, stage: activeStage, category: activeCategory, sort: "newest" }), active: activeSort === "newest" },
              { label: "เก่าก่อน", href: buildIssuesHref({ q: keyword, stage: activeStage, category: activeCategory, sort: "oldest" }), active: activeSort === "oldest" },
              { label: "เร่งด่วนก่อน", href: buildIssuesHref({ q: keyword, stage: activeStage, category: activeCategory, sort: "priority" }), active: activeSort === "priority" },
            ],
          },
        ]}
        actions={
          <>
            <Link href="/admin/issues/board">
              <Button variant="outline" size="sm">บอร์ด</Button>
            </Link>
            <Link href="/admin/issues/new">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> แจ้งปัญหาใหม่
              </Button>
            </Link>
          </>
        }
      />

      {issues.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 sm:p-12 text-center">
          <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700">ไม่พบคำร้อง</p>
        </div>
      ) : (
        <div className="max-h-[65vh] overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[800px] table-fixed text-sm">
            <thead className="sticky top-0 z-10 shadow-[0_1px_0_rgb(229_231_235)]">
              <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="border-l-8 border-l-transparent px-4 py-3 font-medium">หัวข้อ</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">ผู้แจ้ง</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">หมวดหมู่</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">ความสำคัญ</th>
                <th className="px-4 py-3 font-medium">สถานะ</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">วันที่</th>
                <th className="px-4 py-3 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id} className="border-b border-gray-100 last:border-b-0 transition-colors hover:bg-gray-50/80">
                  <td className={`border-l-8 px-4 py-3 ${priorityBorderColor[issue.priority] ?? "border-l-gray-300"}`}>
                    <div className="min-w-0">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 line-clamp-1">{issue.title}</p>
                        {issue.location && (
                          <p className="text-xs text-gray-400">{issue.location}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <p className="truncate text-sm font-medium text-gray-700">{getUserDisplayName(reporterById.get(issue.reporterId))}</p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">{reporterById.get(issue.reporterId)?.phoneNumber ?? "ไม่พบข้อมูลผู้แจ้ง"}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                    {ISSUE_CATEGORY_LABELS[issue.category]}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityBadgeClass[issue.priority] ?? "bg-gray-100 text-gray-800"}`}>
                      {ISSUE_PRIORITY_LABELS[issue.priority]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <IssueStatusIndicator stage={issue.stage} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell tabular-nums">
                    {formatDate(issue.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/issues/${issue.id}`}>
                      <Button size="sm" variant="outline" className="whitespace-nowrap">
                        <Eye className="h-3.5 w-3.5 mr-1" /> จัดการ
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <QueryPagination pathname="/admin/issues" page={page} totalPages={totalPages} params={{ q: keyword || undefined, stage: activeStage !== "ALL" ? activeStage : undefined, category: activeCategory !== "ALL" ? activeCategory : undefined, sort: activeSort !== "newest" ? activeSort : undefined }} />
    </div>
  );
}

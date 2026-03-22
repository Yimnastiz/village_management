import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, Plus, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ISSUE_STAGE_LABELS, ISSUE_CATEGORY_LABELS, ISSUE_PRIORITY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

interface PageProps {
  searchParams: Promise<{ stage?: string; category?: string }>;
}

const stageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  WAITING: "warning",
  RESOLVED: "success",
  CLOSED: "default",
  REJECTED: "danger",
};

const priorityVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  LOW: "default",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "danger",
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

export default async function AdminIssuesPage({ searchParams }: PageProps) {
  const { stage, category } = await searchParams;
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
  });
  if (!membership) redirect("/auth/login");

  const whereClause: Record<string, unknown> = { villageId: membership.villageId };
  if (stage && stage !== "ALL") whereClause.stage = stage;
  if (category && category !== "ALL") whereClause.category = category;

  const [issues, stageCounts] = await Promise.all([
    prisma.issue.findMany({
      where: whereClause,
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        category: true,
        priority: true,
        stage: true,
        createdAt: true,
        location: true,
      },
    }),
    prisma.issue.groupBy({
      by: ["stage"],
      where: { villageId: membership.villageId },
      _count: true,
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const c of stageCounts) counts[c.stage] = c._count;
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  const stageFilters = [
    { value: "ALL", label: "ทั้งหมด", count: totalCount },
    { value: "OPEN", label: "เปิด" },
    { value: "IN_PROGRESS", label: "กำลังดำเนินการ" },
    { value: "WAITING", label: "รอดำเนินการ" },
    { value: "RESOLVED", label: "แก้ไขแล้ว" },
    { value: "CLOSED", label: "ปิด" },
    { value: "REJECTED", label: "ปฏิเสธ" },
  ];

  const activeStage = stage ?? "ALL";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการปัญหา/คำร้อง</h1>
          <p className="text-sm text-gray-500 mt-1">
            เปิด {counts["OPEN"] ?? 0} • กำลังดำเนินการ {counts["IN_PROGRESS"] ?? 0} • รอ {counts["WAITING"] ?? 0}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/issues/board">
            <Button variant="outline" size="sm">บอร์ด</Button>
          </Link>
          <Link href="/admin/issues/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> แจ้งปัญหาใหม่
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {stageFilters.map((filter) => (
          <Link
            key={filter.value}
            href={filter.value === "ALL" ? "/admin/issues" : `/admin/issues?stage=${filter.value}`}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeStage === filter.value
                ? "bg-gray-900 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {filter.label}
            {(filter.count ?? counts[filter.value] ?? 0) > 0 && (
              <span className="text-xs opacity-70">({filter.count ?? counts[filter.value]})</span>
            )}
          </Link>
        ))}
      </div>

      {issues.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700">ไม่พบคำร้อง</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-600">
                <th className="px-4 py-3 font-medium">หัวข้อ</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">หมวดหมู่</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">ความสำคัญ</th>
                <th className="px-4 py-3 font-medium">สถานะ</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">วันที่</th>
                <th className="px-4 py-3 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900 line-clamp-1">{issue.title}</p>
                        {issue.location && (
                          <p className="text-xs text-gray-400">{issue.location}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                    {ISSUE_CATEGORY_LABELS[issue.category]}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <Badge variant={priorityVariant[issue.priority] ?? "default"}>
                      {ISSUE_PRIORITY_LABELS[issue.priority]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={stageVariant[issue.stage] ?? "default"}>
                      {ISSUE_STAGE_LABELS[issue.stage]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell tabular-nums">
                    {formatDate(issue.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/issues/${issue.id}`}>
                      <Button size="sm" variant="outline">
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
    </div>
  );
}

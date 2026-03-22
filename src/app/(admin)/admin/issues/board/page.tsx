import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ISSUE_STAGE_LABELS, ISSUE_CATEGORY_LABELS, ISSUE_PRIORITY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

const priorityVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  LOW: "default",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "danger",
};

const stageColors: Record<string, string> = {
  OPEN: "border-yellow-200 bg-yellow-50",
  IN_PROGRESS: "border-blue-200 bg-blue-50",
  WAITING: "border-orange-200 bg-orange-50",
  RESOLVED: "border-green-200 bg-green-50",
  CLOSED: "border-gray-200 bg-gray-50",
  REJECTED: "border-red-200 bg-red-50",
};

const BOARD_STAGES = ["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED", "REJECTED"] as const;

function formatDate(date: Date): string {
  return date.toLocaleDateString("th-TH", { month: "short", day: "numeric" });
}

export default async function AdminIssuesBoardPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
  });
  if (!membership) redirect("/auth/login");

  const issues = await prisma.issue.findMany({
    where: { villageId: membership.villageId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      category: true,
      priority: true,
      stage: true,
      createdAt: true,
    },
  });

  const grouped = BOARD_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = issues.filter((issue) => issue.stage === stage);
      return acc;
    },
    {} as Record<string, typeof issues>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">บอร์ดปัญหา/คำร้อง</h1>
          <p className="text-sm text-gray-500 mt-1">ทั้งหมด {issues.length} รายการ</p>
        </div>
        <Link
          href="/admin/issues"
          className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5"
        >
          แสดงเป็นรายการ
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {BOARD_STAGES.map((stage) => (
          <div key={stage} className={`rounded-xl border p-4 ${stageColors[stage]}`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800 text-sm">{ISSUE_STAGE_LABELS[stage]}</h2>
              <span className="text-xs text-gray-500 bg-white/60 rounded-full px-2 py-0.5">
                {grouped[stage]?.length ?? 0}
              </span>
            </div>
            <div className="space-y-2">
              {(grouped[stage] ?? []).length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">ไม่มีรายการ</p>
              ) : (
                (grouped[stage] ?? []).map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/admin/issues/${issue.id}`}
                    className="block bg-white rounded-lg border border-gray-100 p-3 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">{issue.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={priorityVariant[issue.priority] ?? "default"} className="text-xs">
                            {ISSUE_PRIORITY_LABELS[issue.priority]}
                          </Badge>
                          <span className="text-xs text-gray-400">{formatDate(issue.createdAt)}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{ISSUE_CATEGORY_LABELS[issue.category]}</p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

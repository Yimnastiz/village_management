import Link from "next/link";
import { AlertCircle, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ISSUE_STAGE_LABELS, ISSUE_CATEGORY_LABELS, ISSUE_PRIORITY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies } from "@/lib/access-control";

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

export default async function ResidentIssuesPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const issues = await prisma.issue.findMany({
    where: { reporterId: session.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      category: true,
      priority: true,
      stage: true,
      createdAt: true,
      location: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ปัญหา/คำร้อง</h1>
          <p className="text-sm text-gray-500 mt-1">คำร้องทั้งหมดของคุณ ({issues.length} รายการ)</p>
        </div>
        <Link href="/resident/issues/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> แจ้งปัญหาใหม่
          </Button>
        </Link>
      </div>

      {issues.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700">ยังไม่มีคำร้อง</p>
          <p className="text-sm text-gray-500 mt-1">กดปุ่มด้านบนเพื่อแจ้งปัญหาใหม่</p>
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <Link
              key={issue.id}
              href={`/resident/issues/${issue.id}`}
              className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <AlertCircle className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{issue.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {ISSUE_CATEGORY_LABELS[issue.category]} • {formatDate(issue.createdAt)}
                      {issue.location && ` • ${issue.location}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge
                    variant={priorityVariant[issue.priority] ?? "default"}
                    className="hidden sm:inline-flex"
                  >
                    {ISSUE_PRIORITY_LABELS[issue.priority]}
                  </Badge>
                  <Badge variant={stageVariant[issue.stage] ?? "default"}>
                    {ISSUE_STAGE_LABELS[issue.stage]}
                  </Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

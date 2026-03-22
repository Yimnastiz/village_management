import Link from "next/link";
import { ArrowLeft, Clock, Lock } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Timeline } from "@/components/ui/timeline";
import { ISSUE_STAGE_LABELS, ISSUE_CATEGORY_LABELS, ISSUE_PRIORITY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import {
  AdminEditForm,
  AdminStageForm,
  AdminDeleteButton,
  AdminMessageForm,
} from "./admin-issue-client";

interface PageProps { params: Promise<{ issueId: string }> }

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
  return date.toLocaleDateString("th-TH", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default async function AdminIssueDetailPage({ params }: PageProps) {
  const { issueId } = await params;
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
  });
  if (!membership) redirect("/auth/login");

  const issue = await prisma.issue.findFirst({
    where: { id: issueId, villageId: membership.villageId },
    include: {
      timeline: { orderBy: { createdAt: "asc" } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!issue) notFound();

  const categoryOptions = Object.entries(ISSUE_CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }));
  const priorityOptions = Object.entries(ISSUE_PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }));
  const stageOptions = Object.entries(ISSUE_STAGE_LABELS).map(([v, l]) => ({ value: v, label: l }));

  const publicMessages = issue.messages.filter((m) => !m.isInternal);
  const internalMessages = issue.messages.filter((m) => m.isInternal);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/admin/issues"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> กลับรายการ
        </Link>
        <AdminDeleteButton issueId={issueId} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Issue details + edit */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-gray-400 mb-1 font-mono">#{issue.id.slice(0, 8).toUpperCase()}</p>
                <h1 className="text-xl font-bold text-gray-900">{issue.title}</h1>
              </div>
              <Badge variant={stageVariant[issue.stage] ?? "default"}>
                {ISSUE_STAGE_LABELS[issue.stage]}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div>
                <span className="text-gray-500">หมวดหมู่: </span>
                <span className="font-medium">{ISSUE_CATEGORY_LABELS[issue.category]}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">ความสำคัญ: </span>
                <Badge variant={priorityVariant[issue.priority] ?? "default"}>
                  {ISSUE_PRIORITY_LABELS[issue.priority]}
                </Badge>
              </div>
              <div>
                <span className="text-gray-500">วันที่แจ้ง: </span>
                <span className="font-medium">{formatDate(issue.createdAt)}</span>
              </div>
              {issue.location && (
                <div>
                  <span className="text-gray-500">สถานที่: </span>
                  <span className="font-medium">{issue.location}</span>
                </div>
              )}
            </div>
            <div className="border-t pt-4 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">รายละเอียด</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{issue.description}</p>
            </div>
            <AdminEditForm
              issueId={issueId}
              defaultValues={{
                title: issue.title,
                description: issue.description,
                category: issue.category,
                priority: issue.priority,
                location: issue.location ?? "",
              }}
              categoryOptions={categoryOptions}
              priorityOptions={priorityOptions}
            />
          </div>

          {/* Messages */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">ข้อความสาธารณะ</h2>
            {publicMessages.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">ยังไม่มีข้อความสาธารณะ</p>
            ) : (
              <div className="space-y-3 mb-4">
                {publicMessages.map((msg) => (
                  <div key={msg.id} className="rounded-lg bg-gray-50 px-4 py-3 text-sm">
                    <p className="text-gray-700 whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(msg.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
            {internalMessages.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-2 border-t pt-4">
                  <Lock className="h-3.5 w-3.5 text-amber-500" />
                  <p className="text-xs font-medium text-amber-700">บันทึกภายใน (ลูกบ้านไม่เห็น)</p>
                </div>
                <div className="space-y-3 mb-4">
                  {internalMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 text-sm"
                    >
                      <p className="text-gray-700 whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatDate(msg.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
            <AdminMessageForm issueId={issueId} />
          </div>
        </div>

        {/* Right: Stage + Timeline */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">เปลี่ยนสถานะ</h2>
            <AdminStageForm
              issueId={issueId}
              currentStage={issue.stage}
              stageOptions={stageOptions}
            />
          </div>

          {issue.timeline.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" /> ความคืบหน้า
              </h2>
              <Timeline items={issue.timeline} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

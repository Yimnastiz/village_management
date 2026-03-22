import Link from "next/link";
import { ArrowLeft, Edit, Clock } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Timeline } from "@/components/ui/timeline";
import { ISSUE_STAGE_LABELS, ISSUE_CATEGORY_LABELS, ISSUE_PRIORITY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { DeleteIssueButton, MessageForm } from "./issue-client";

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

export default async function ResidentIssueDetailPage({ params }: PageProps) {
  const { issueId } = await params;
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: {
      timeline: { orderBy: { createdAt: "asc" } },
      messages: { where: { isInternal: false }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!issue) notFound();

  const isOwner = issue.reporterId === session.id;
  const canEdit = isOwner && issue.stage === "OPEN";
  const canMessage = issue.stage !== "CLOSED" && issue.stage !== "REJECTED";

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/resident/issues" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> กลับรายการปัญหา
        </Link>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Link href={`/resident/issues/${issueId}/edit`}>
              <Button size="sm" variant="outline">
                <Edit className="h-4 w-4 mr-1" /> แก้ไข
              </Button>
            </Link>
            <DeleteIssueButton issueId={issueId} />
          </div>
        )}
      </div>

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
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
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
          {issue.resolvedAt && (
            <div className="col-span-2">
              <span className="text-gray-500">แก้ไขเมื่อ: </span>
              <span className="font-medium">{formatDate(issue.resolvedAt)}</span>
            </div>
          )}
        </div>
        <div className="border-t pt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">รายละเอียด</p>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{issue.description}</p>
        </div>
      </div>

      {issue.timeline.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" /> ความคืบหน้า
          </h2>
          <Timeline items={issue.timeline} />
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">ข้อความ/ความคิดเห็น</h2>
        {issue.messages.length === 0 ? (
          <p className="text-sm text-gray-400 mb-4">ยังไม่มีข้อความ</p>
        ) : (
          <div className="space-y-3 mb-4">
            {issue.messages.map((msg) => (
              <div key={msg.id} className="rounded-lg bg-gray-50 px-4 py-3 text-sm">
                <p className="text-gray-700 whitespace-pre-wrap">{msg.content}</p>
                <p className="text-xs text-gray-400 mt-1">{formatDate(msg.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
        {canMessage && <MessageForm issueId={issueId} />}
        {issue.stage === "RESOLVED" && isOwner && (
          <div className="mt-4 rounded-lg bg-green-50 p-4 border border-green-200">
            <p className="text-sm font-medium text-green-800">ปัญหาได้รับการแก้ไขแล้ว</p>
            <p className="text-xs text-green-700 mt-1">หากพอใจกับการแก้ไข กรุณาให้คะแนนบริการ</p>
            <Link href={`/resident/issues/${issueId}/feedback`} className="mt-2 inline-block">
              <Button size="sm" variant="outline" className="border-green-300 text-green-700 hover:bg-green-100">
                ให้คะแนนบริการ
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft, Edit, Clock } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Timeline } from "@/components/ui/timeline";
import { ImageCarousel } from "@/components/ui/image-carousel";
import { SaveButton } from "@/components/ui/save-button";
import { ISSUE_CATEGORY_LABELS, ISSUE_PRIORITY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { formatThaiDateTime } from "@/lib/utils";
import { getUserDisplayName, getUserRoleLabel } from "@/lib/user-display";
import { toggleSaveIssueAction } from "@/features/saved/server/actions";
import { DeleteIssueButton, MessageForm } from "./issue-client";
import { IssueStatusIndicator } from "@/components/issues/issue-status-indicator";
import { getIssueUserStatus } from "@/lib/issues/status";
import { getIssuePriorityMeta } from "@/lib/issues/priority";

interface PageProps { params: Promise<{ issueId: string }> }

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

  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");

  const issue = await prisma.issue.findFirst({
    where: { id: issueId, villageId: membership.villageId },
    include: {
      timeline: { orderBy: { createdAt: "asc" } },
      messages: { where: { isInternal: false }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!issue) notFound();

  const saved = await prisma.savedItem.findFirst({
    where: { userId: session.id, issueId: issue.id },
    select: { id: true },
  });

  const isOwner = issue.reporterId === session.id;
  if (!isOwner && !issue.isPublic) notFound();

  const userIds = Array.from(new Set([
    issue.reporterId,
    ...issue.messages.map((message) => message.senderId),
    ...issue.timeline.map((item) => item.actorId).filter((id): id is string => Boolean(id)),
  ]));
  // Deliberately exclude phoneNumber: this object is serialized to the resident client view.
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, systemRole: true, memberships: { where: { villageId: membership.villageId, status: "ACTIVE" }, select: { role: true }, take: 1 } },
  });
  const userById = new Map(users.map((user) => [user.id, user]));
  const reporter = userById.get(issue.reporterId);
  const timelineItems = issue.timeline.map((item) => {
    const actor = item.actorId ? userById.get(item.actorId) : undefined;
    return { ...item, actorName: actor ? getUserDisplayName(actor) : null, actorRoleLabel: actor ? getUserRoleLabel(actor) : null };
  });

  const imageUrls = Array.isArray(issue.imageUrls)
    ? issue.imageUrls.map((value) => String(value)).filter((url) => url.length > 0)
    : [];
  const canEdit = isOwner && getIssueUserStatus(issue.stage) === "PENDING";
  const canMessage =
    issue.stage !== "CLOSED" && issue.stage !== "REJECTED" && (isOwner || issue.isPublic);
  const priorityMeta = getIssuePriorityMeta(issue.priority);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/resident/issues" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> กลับรายการปัญหา
        </Link>
        {canEdit && (
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Link href={`/resident/issues/${issueId}/edit`}>
              <Button size="sm" variant="outline">
                <Edit className="h-4 w-4 mr-1" /> แก้ไข
              </Button>
            </Link>
            <DeleteIssueButton issueId={issueId} />
          </div>
        )}
      </div>

      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${priorityMeta.stripeClass}`} />
        <span className="sr-only">ระดับความสำคัญ: {priorityMeta.label}</span>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs text-gray-400 mb-1 font-mono">#{issue.id.slice(0, 8).toUpperCase()}</p>
            <h1 className="text-xl font-bold text-gray-900">{issue.title}</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <IssueStatusIndicator stage={issue.stage} />
            <SaveButton
              itemId={issue.id}
              initialSaved={Boolean(saved)}
              toggleAction={toggleSaveIssueAction}
              label="บันทึกปัญหา"
            />
          </div>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
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
          <div className="col-span-2">
            <span className="text-gray-500">การมองเห็น: </span>
            <span className="font-medium">
              {issue.isPublic ? "เปิดเผยต่อชุมชน" : "เฉพาะผู้แจ้งและผู้ดูแล"}
            </span>
          </div>
          <div className="col-span-2 rounded-lg border bg-gray-50 p-3">
            <p className="text-gray-500">ผู้แจ้งปัญหา</p>
            <p className="mt-1 font-medium text-gray-800">{isOwner ? "คุณเป็นผู้แจ้งปัญหานี้" : `แจ้งโดย ${getUserDisplayName(reporter)}`}</p>
            <p className="text-xs text-gray-500">{reporter ? getUserRoleLabel(reporter) : "ผู้ใช้งาน"} · {formatThaiDateTime(issue.createdAt)}</p>
          </div>
          {!isOwner && (
            <div className="col-span-2">
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                ปัญหาของลูกบ้านคนอื่น
              </span>
            </div>
          )}
        </div>
        <div className="border-t pt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">รายละเอียด</p>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{issue.description}</p>
        </div>
        {imageUrls.length > 0 && (
          <div className="border-t pt-4 mt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">รูปภาพประกอบ</p>
            <ImageCarousel images={imageUrls} altPrefix={issue.title} />
          </div>
        )}
      </div>

      {issue.timeline.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" /> ความคืบหน้า
          </h2>
          <Timeline items={timelineItems} />
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <h2 className="font-semibold text-gray-900 mb-4">ข้อความ/ความคิดเห็น</h2>
        {issue.messages.length === 0 ? (
          <p className="text-sm text-gray-400 mb-4">ยังไม่มีข้อความ</p>
        ) : (
          <div className="space-y-3 mb-4">
            {issue.messages.map((msg) => {
              const sender = userById.get(msg.senderId);
              return <div key={msg.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm sm:p-4">
                <p className="break-words font-medium text-gray-900">{msg.senderId === session.id ? "คุณ" : getUserDisplayName(sender)} <span className="font-normal text-gray-500">· {sender ? getUserRoleLabel(sender) : "ผู้ใช้งาน"}</span></p>
                <time className="mt-1 block text-xs text-gray-400">{formatThaiDateTime(msg.createdAt)}</time>
                <p className="mt-3 whitespace-pre-wrap break-words text-gray-700">{msg.content}</p>
              </div>;
            })}
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

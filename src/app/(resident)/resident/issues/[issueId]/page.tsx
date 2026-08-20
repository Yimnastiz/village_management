import Link from "next/link";
import { ArrowLeft, Edit } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Timeline } from "@/components/ui/timeline";
import { ImageCarousel } from "@/components/ui/image-carousel";
import { SaveButton } from "@/components/ui/save-button";
import { ISSUE_CATEGORY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { formatThaiDateTime } from "@/lib/utils";
import { getUserDisplayName, getUserRoleLabel } from "@/lib/user-display";
import { toggleSaveIssueAction } from "@/features/saved/server/actions";
import { DeleteIssueButton, MessageForm } from "./issue-client";
import { IssueStatusIndicator } from "@/components/issues/issue-status-indicator";
import { getIssueUserStatus } from "@/lib/issues/status";
import { getIssuePriorityMeta } from "@/lib/issues/priority";
import { normalizeIssueImageUrls } from "@/lib/issues/images";

interface PageProps { params: Promise<{ issueId: string }> }

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

  const imageUrls = normalizeIssueImageUrls(issue.imageUrls);
  const canEdit = isOwner && getIssueUserStatus(issue.stage) === "PENDING";
  const canMessage =
    issue.stage !== "CLOSED" && issue.stage !== "REJECTED" && (isOwner || issue.isPublic);
  const priorityMeta = getIssuePriorityMeta(issue.priority);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
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

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 sm:p-6 lg:col-span-2 lg:order-1">
        <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${priorityMeta.stripeClass}`} />
        <span className="sr-only">ระดับความสำคัญ: {priorityMeta.label}</span>
          <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <IssueStatusIndicator stage={issue.stage} className="mb-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1" />
            <h1 className="text-xl font-bold text-gray-900">{issue.title}</h1>
          </div>
          <div className="shrink-0">
            <SaveButton
              itemId={issue.id}
              initialSaved={Boolean(saved)}
              toggleAction={toggleSaveIssueAction}
              label="บันทึกปัญหา"
            />
          </div>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <div className="space-y-3">
            <p><span className="text-gray-500">หมวดหมู่: </span><span className="font-medium">{ISSUE_CATEGORY_LABELS[issue.category]}</span></p>
            <p><span className="text-gray-500">วันที่แจ้ง: </span><span className="font-medium">{formatDate(issue.createdAt)}</span></p>
            <p className="text-gray-600">แจ้งโดย <span className="font-medium text-gray-800">{isOwner ? "คุณ" : getUserDisplayName(reporter)}</span> <span className="text-gray-500">({reporter ? getUserRoleLabel(reporter) : "ผู้ใช้งาน"})</span></p>
          </div>
          <div className="space-y-3">
            <p className="flex items-center gap-2"><span className="text-gray-500">ความสำคัญ: </span><span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${priorityMeta.badgeClass}`}>{priorityMeta.label}</span></p>
            <p><span className="text-gray-500">การมองเห็น: </span><span className="font-medium">{issue.isPublic ? "เปิดเผยต่อชุมชน" : "เฉพาะผู้แจ้งและผู้ดูแล"}</span></p>
            {issue.location && <p><span className="text-gray-500">สถานที่: </span><span className="font-medium">{issue.location}</span></p>}
          </div>
        </div>
        <div className="border-t border-gray-200 pt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">รายละเอียด</p>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{issue.description}</p>
        </div>
        {imageUrls.length > 0 && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">รูปภาพประกอบ</p>
            <ImageCarousel images={imageUrls} altPrefix={issue.title} thumbnailBehavior="select" />
          </div>
        )}
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 lg:col-span-1 lg:order-2 lg:self-start">
          <p className="text-sm font-semibold text-gray-900">ความคืบหน้า</p>
          {issue.resolvedAt && (
            <div className="mt-4 border-t border-gray-200 pt-4 text-sm">
              <p className="text-gray-500">แก้ไขเมื่อ</p>
              <p className="mt-1 font-medium text-gray-800">{formatDate(issue.resolvedAt)}</p>
            </div>
          )}
          <div className="mt-4 border-t border-gray-200 pt-4"><Timeline items={timelineItems} /></div>
        </aside>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 lg:col-span-2 lg:order-3">
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
      </div>
    </div>
  );
}

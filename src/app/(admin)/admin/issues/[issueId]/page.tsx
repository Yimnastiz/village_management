import Link from "next/link";
import { ArrowLeft, Clock, Lock } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Timeline } from "@/components/ui/timeline";
import { ImageCarousel } from "@/components/ui/image-carousel";
import { ISSUE_STAGE_LABELS, ISSUE_CATEGORY_LABELS, ISSUE_PRIORITY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { formatThaiDateTime } from "@/lib/utils";
import { getUserDisplayName, getUserRoleLabel } from "@/lib/user-display";
import { issueStageBadgeVariant } from "@/components/issues/issue-status-indicator";
import {
  AdminEditForm,
  AdminStageForm,
  AdminDeleteButton,
  AdminMessageForm,
} from "./admin-issue-client";

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

  const userIds = Array.from(new Set([
    issue.reporterId,
    ...issue.messages.map((message) => message.senderId),
    ...issue.timeline.map((item) => item.actorId).filter((id): id is string => Boolean(id)),
  ]));
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true, name: true, phoneNumber: true, systemRole: true,
      memberships: { where: { villageId: membership.villageId, status: "ACTIVE" }, select: { role: true }, take: 1 },
    },
  });
  const userById = new Map(users.map((user) => [user.id, user]));
  const reporter = userById.get(issue.reporterId);
  const imageUrls = Array.isArray(issue.imageUrls) ? issue.imageUrls.map((value) => String(value)).filter((url) => url.length > 0) : [];
  const timelineItems = issue.timeline.map((item) => {
    const actor = item.actorId ? userById.get(item.actorId) : undefined;
    return { ...item, actorName: actor ? getUserDisplayName(actor) : null, actorRoleLabel: actor ? getUserRoleLabel(actor) : null };
  });

  const categoryOptions = Object.entries(ISSUE_CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }));
  const priorityOptions = Object.entries(ISSUE_PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }));
  const stageOptions = Object.entries(ISSUE_STAGE_LABELS).map(([v, l]) => ({ value: v, label: l }));

  const publicMessages = issue.messages.filter((m) => !m.isInternal);
  const internalMessages = issue.messages.filter((m) => m.isInternal);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-1 font-mono">#{issue.id.slice(0, 8).toUpperCase()}</p>
                <h1 className="text-xl font-bold text-gray-900">{issue.title}</h1>
              </div>
              <Badge className="self-start" variant={issueStageBadgeVariant[issue.stage] ?? "default"}>
                {ISSUE_STAGE_LABELS[issue.stage]}
              </Badge>
            </div>
            <div className="mb-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
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
            <div className="mb-4 rounded-lg border bg-gray-50 p-4 text-sm">
              <p className="mb-2 font-medium text-gray-800">ข้อมูลผู้แจ้ง</p>
              <dl className="grid gap-2 sm:grid-cols-2">
                <div><dt className="text-gray-500">ชื่อ</dt><dd className="break-words font-medium">{getUserDisplayName(reporter)}</dd></div>
                <div><dt className="text-gray-500">เบอร์โทร</dt><dd>{reporter?.phoneNumber ? <a className="font-medium text-blue-700 hover:underline" href={`tel:${reporter.phoneNumber}`}>{reporter.phoneNumber}</a> : "ไม่พบข้อมูลผู้แจ้ง"}</dd></div>
                <div><dt className="text-gray-500">บทบาท</dt><dd>{reporter ? getUserRoleLabel(reporter) : "ผู้ใช้งาน"}</dd></div>
                <div><dt className="text-gray-500">แจ้งเมื่อ</dt><dd>{formatThaiDateTime(issue.createdAt)}</dd></div>
              </dl>
            </div>
            {imageUrls.length > 0 && <div className="mb-4 border-t pt-4"><p className="mb-2 text-sm font-medium text-gray-700">รูปภาพประกอบปัญหา</p><ImageCarousel images={imageUrls} altPrefix={issue.title} /></div>}
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
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <h2 className="font-semibold text-gray-900 mb-4">ข้อความสาธารณะ</h2>
            {publicMessages.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">ยังไม่มีข้อความสาธารณะ</p>
            ) : (
              <div className="space-y-3 mb-4">
                {publicMessages.map((msg) => <MessageCard key={msg.id} msg={msg} user={userById.get(msg.senderId)} />)}
              </div>
            )}
            {internalMessages.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-2 border-t pt-4">
                  <Lock className="h-3.5 w-3.5 text-amber-500" />
                  <p className="text-xs font-medium text-amber-700">บันทึกภายใน (ลูกบ้านไม่เห็น)</p>
                </div>
                <div className="space-y-3 mb-4">
                  {internalMessages.map((msg) => <MessageCard key={msg.id} msg={msg} user={userById.get(msg.senderId)} internal />)}
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
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" /> ความคืบหน้า
              </h2>
              <Timeline items={timelineItems} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageCard({ msg, user, internal = false }: { msg: { content: string; createdAt: Date }; user?: { name: string; phoneNumber: string; systemRole: string; memberships: { role: string }[] }; internal?: boolean }) {
  return <div className={`rounded-xl border p-3 text-sm sm:p-4 ${internal ? "border-amber-100 bg-amber-50" : "border-gray-200 bg-gray-50"}`}>
    <p className="break-words font-medium text-gray-900">{getUserDisplayName(user)} <span className="font-normal text-gray-500">· {user ? getUserRoleLabel(user) : "ผู้ใช้งาน"}</span></p>
    <p className="mt-1 text-xs text-gray-500">{user?.phoneNumber ? <a className="hover:underline" href={`tel:${user.phoneNumber}`}>{user.phoneNumber}</a> : "ไม่พบข้อมูลผู้ใช้งาน"}</p>
    <time className="mt-1 block text-xs text-gray-400">{formatThaiDateTime(msg.createdAt)}</time>
    <p className="mt-3 whitespace-pre-wrap break-words text-gray-700">{msg.content}</p>
  </div>;
}

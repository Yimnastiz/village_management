import { NotificationStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { feedbackMetadataString, getFeedbackById, markFeedbackAsReadIfUnread } from "@/features/feedback/server/feedback-service";
import { updateAdminFeedbackStatusAction } from "../actions";
import { requireVillagePagePermission } from "@/lib/admin-permission.server";
import { categoryClassName, categoryLabel, statusLabels } from "../feedback-presentation";

export default async function AdminFeedbackDetailPage({ params }: { params: Promise<{ feedbackId: string }> }) {
  const context = await requireVillagePagePermission("feedback.manage", { callbackUrl: "/admin/feedback" });
  const { feedbackId } = await params;
  const initial = await getFeedbackById(feedbackId, context.villageId);
  if (!initial) notFound();
  await markFeedbackAsReadIfUnread(feedbackId, context.villageId);
  const feedback = await getFeedbackById(feedbackId, context.villageId);
  if (!feedback) notFound();
  const name = feedbackMetadataString(feedback.metadata, "name");
  const email = feedbackMetadataString(feedback.metadata, "email");
  const category = feedbackMetadataString(feedback.metadata, "category");
  const action = (operation: "unread" | "archive" | "restore", label: string, className = "") => <form action={updateAdminFeedbackStatusAction}><input type="hidden" name="feedbackId" value={feedback.id} /><input type="hidden" name="operation" value={operation} /><button className={`min-h-9 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 ${className}`}>{label}</button></form>;
  return <div data-admin-compact-top className="space-y-4"><AdminPageToolbar compact sticky variant="detail" title="รายละเอียดความคิดเห็น" backHref="/admin/feedback" backLabel="กลับรายการความคิดเห็น" backPlacement="header-end" actions={<div className="flex flex-wrap gap-2">{feedback.status === NotificationStatus.ARCHIVED ? action("restore", "นำกลับเข้ากล่องขาเข้า", "border-emerald-200 text-emerald-800 hover:bg-emerald-50") : <>{action("unread", "ตั้งเป็นยังไม่ได้อ่าน")}{action("archive", "เก็บถาวร")}</>}</div>} /><main className="mx-auto w-full max-w-4xl"><article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 sm:p-8"><header><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${categoryClassName(category)}`}>{categoryLabel(category)}</span><span className="text-xs text-gray-500">{statusLabels[feedback.status]}</span><time className="text-xs text-gray-400" dateTime={feedback.createdAt.toISOString()}>ส่งเมื่อ {feedback.createdAt.toLocaleString("th-TH")}</time></div><h1 className="mt-4 break-words text-2xl font-bold tracking-tight text-gray-950">{feedback.title || "รายละเอียดความคิดเห็น"}</h1></header><p className="mt-6 whitespace-pre-wrap break-words text-base leading-8 text-gray-800">{feedback.body || "ไม่มีรายละเอียด"}</p><section className="mt-8 rounded-xl bg-gray-50 p-4 sm:p-5" aria-labelledby="sender"><h2 id="sender" className="text-sm font-semibold text-gray-900">ข้อมูลผู้ส่ง</h2><dl className="mt-3 grid gap-4 text-sm sm:grid-cols-3"><div className="min-w-0"><dt className="text-xs text-gray-500">ชื่อผู้ส่ง</dt><dd className="mt-1 break-words font-medium text-gray-900">{name || "ไม่ระบุชื่อ"}</dd></div><div className="min-w-0"><dt className="text-xs text-gray-500">อีเมล</dt><dd className="mt-1 break-all font-medium text-gray-900">{email || "ไม่ระบุ"}</dd></div><div className="min-w-0"><dt className="text-xs text-gray-500">ส่งเมื่อ</dt><dd className="mt-1 break-words font-medium text-gray-900">{feedback.createdAt.toLocaleString("th-TH")}</dd></div></dl></section></article></main></div>;
}

import { NotificationStatus, Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { getFeedbackById, markFeedbackAsReadIfUnread } from "../feedback-service";
import { updateFeedbackNotificationStatusAction } from "../actions";

const CATEGORY_LABELS = {
  suggestion: "ข้อเสนอแนะ",
  complaint: "ข้อร้องเรียน",
  bug: "รายงานข้อผิดพลาด",
  other: "อื่น ๆ",
} as const;
type PageProps = { params: Promise<{ feedbackId: string }> };

function metadataString(metadata: Prisma.JsonValue | null, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function categoryBadgeClass(category: string | null) {
  if (category === "suggestion") return "border-blue-200 bg-blue-50 text-blue-800";
  if (category === "complaint") return "border-rose-200 bg-rose-50 text-rose-800";
  if (category === "bug") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function StatusAction({ notificationId, status, label }: { notificationId: string; status?: NotificationStatus; label: string }) {
  return <form action={updateFeedbackNotificationStatusAction}>
    <input type="hidden" name="notificationId" value={notificationId} />
    {status ? <input type="hidden" name="status" value={status} /> : <input type="hidden" name="operation" value="restore" />}
    <button type="submit" className="inline-flex min-h-9 items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-1">{label}</button>
  </form>;
}

export default async function SuperAdminFeedbackDetailPage({ params }: PageProps) {
  await requireSuperAdminPageSession();
  const { feedbackId } = await params;
  const initialFeedback = await getFeedbackById(feedbackId);
  if (!initialFeedback) notFound();

  await markFeedbackAsReadIfUnread(feedbackId);
  const feedback = await getFeedbackById(feedbackId);
  if (!feedback) notFound();

  const category = metadataString(feedback.metadata, "category");
  const name = metadataString(feedback.metadata, "name");
  const email = metadataString(feedback.metadata, "email");
  const title = feedback.title?.trim() || "รายละเอียดความคิดเห็น";

  return (
    <div className="workspace-detail-page -mt-4 flex min-h-0 w-full flex-col gap-4 sm:-mt-6">
      <SuperAdminPageHeaderRegistration context={{ title, description: "ตรวจสอบข้อความและข้อมูลผู้ส่ง" }} />
      <AdminPageToolbar variant="detail" compact sticky hideHeading title="รายละเอียดความคิดเห็น" actions={<div className="flex w-full min-w-0 flex-wrap items-center gap-2"><Link href="/superadmin/feedback" className="inline-flex min-h-9 items-center rounded-md px-1 text-sm font-medium text-slate-600 transition hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600">กลับกล่องความคิดเห็น</Link><div className="ml-auto flex flex-wrap justify-end gap-2">{feedback.status === NotificationStatus.ARCHIVED ? <StatusAction notificationId={feedback.id} label="นำกลับเข้ากล่องขาเข้า" /> : <><StatusAction notificationId={feedback.id} status={NotificationStatus.UNREAD} label="ตั้งเป็นยังไม่อ่าน" /><StatusAction notificationId={feedback.id} status={NotificationStatus.ARCHIVED} label="เก็บถาวร" /></>}</div></div>} />
      <main className="mx-auto w-full max-w-3xl min-w-0">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            {category ? <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${categoryBadgeClass(category)}`}>{CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? "อื่น ๆ"}</span> : null}
          </div>
          <h1 className="mt-4 break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
          <div className="mt-6 border-t border-slate-100 pt-6">
            <p className="whitespace-pre-wrap break-words text-base leading-8 text-slate-800">{feedback.body || "ไม่พบรายละเอียด"}</p>
          </div>
          <section className="mt-8 border-t border-slate-200 pt-6" aria-labelledby="sender-heading">
            <h2 id="sender-heading" className="text-base font-semibold text-slate-900">ข้อมูลผู้ส่ง</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <div className="min-w-0"><dt className="text-slate-500">ชื่อ</dt><dd className="mt-1 break-words font-medium text-slate-900">{name || "ไม่ระบุ"}</dd></div>
              <div className="min-w-0"><dt className="text-slate-500">อีเมล</dt><dd className="mt-1 break-all font-medium text-slate-900">{email || "ไม่ระบุ"}</dd></div>
              <div className="min-w-0"><dt className="text-slate-500">ส่งเมื่อ</dt><dd className="mt-1 break-words font-medium text-slate-900"><time dateTime={feedback.createdAt.toISOString()}>{feedback.createdAt.toLocaleString("th-TH")}</time></dd></div>
            </dl>
          </section>
        </article>
        <Link href="/superadmin/feedback" className="mt-4 inline-flex text-sm font-medium text-cyan-700 hover:text-cyan-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600">กลับกล่องความคิดเห็น</Link>
      </main>
    </div>
  );
}

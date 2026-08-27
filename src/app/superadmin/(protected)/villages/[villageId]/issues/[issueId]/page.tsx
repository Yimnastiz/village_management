import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { addSuperAdminIssueMessageAction, updateSuperAdminIssueAction } from "../../operational-actions";

export default async function Page({ params }: { params: Promise<{ villageId: string; issueId: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId, issueId } = await params;
  const issue = await prisma.issue.findFirst({ where: { id: issueId, villageId }, include: { timeline: { orderBy: { createdAt: "desc" } } } });
  if (!issue) notFound();
  const base = `/superadmin/villages/${villageId}/issues`;
  return <div className="mx-auto max-w-4xl space-y-4">
    <Link href={base} className="text-sm text-slate-500">← กลับรายการปัญหา</Link>
    <section className="rounded-xl border bg-white p-5"><div className="flex justify-between gap-3"><div><h2 className="text-xl font-semibold">{issue.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{issue.description}</p></div><Badge variant="outline">{issue.stage}</Badge></div></section>
    <section className="rounded-xl border bg-white p-5"><h3 className="font-semibold">ดำเนินการแทนผู้ดูแลหมู่บ้าน</h3><form action={updateSuperAdminIssueAction.bind(null, villageId, issue.id)} className="mt-3 grid gap-3 sm:grid-cols-2"><select name="status" required defaultValue="" className="min-h-10 rounded-lg border px-3"><option value="" disabled>เลือกสถานะถัดไป</option><option value="IN_PROGRESS">กำลังดำเนินการ</option><option value="WAITING">รอข้อมูลเพิ่มเติม</option><option value="RESOLVED">แก้ไขแล้ว</option><option value="CLOSED">ปิดเรื่อง</option><option value="REJECTED">ไม่รับดำเนินการ</option></select><input name="note" placeholder="รายละเอียดความคืบหน้า" className="min-h-10 rounded-lg border px-3" /><input name="supportReason" required minLength={5} placeholder="เหตุผลในการดำเนินการ" className="min-h-10 rounded-lg border px-3 sm:col-span-2" /><button className="min-h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white sm:col-span-2">บันทึกสถานะ</button></form></section>
    <section className="rounded-xl border bg-white p-5"><h3 className="font-semibold">เพิ่มความคืบหน้า</h3><form action={addSuperAdminIssueMessageAction.bind(null, villageId, issue.id)} className="mt-3 grid gap-3"><textarea name="content" required minLength={2} className="min-h-24 rounded-lg border px-3 py-2" placeholder="ข้อความสำหรับผู้แจ้งปัญหา" /><input name="supportReason" required minLength={5} className="min-h-10 rounded-lg border px-3" placeholder="เหตุผลในการดำเนินการ" /><button className="min-h-10 rounded-lg border px-4 text-sm font-medium">ส่งความคืบหน้า</button></form></section>
    <section className="rounded-xl border bg-white p-5"><h3 className="font-semibold">ประวัติการดำเนินการ</h3><div className="mt-3 divide-y">{issue.timeline.map(item => <div key={item.id} className="py-3 text-sm"><p>{item.action}</p>{item.description ? <p className="mt-1 text-slate-500">{item.description}</p> : null}<p className="mt-1 text-xs text-slate-400">{item.createdAt.toLocaleString("th-TH")}</p></div>)}</div></section>
  </div>;
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { reviewSuperAdminCalendarRequestAction } from "../../operational-actions";

export default async function Page({ params }: { params: Promise<{ villageId: string }> }) {
  const { villageId } = await params;
  const requests = await prisma.villageEventSubmission.findMany({ where: { villageId, status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { requester: { select: { name: true } } } });
  return <div className="space-y-4"><Link href={`/superadmin/villages/${villageId}/calendar`} className="text-sm text-slate-600">← ปฏิทินกิจกรรม</Link><h2 className="text-lg font-semibold">คำขอกิจกรรมรอพิจารณา</h2><section className="rounded-lg border bg-white">{requests.map((request) => { const review = reviewSuperAdminCalendarRequestAction.bind(null, villageId, request.id); return <div key={request.id} className="space-y-3 border-b p-4"><div><p className="font-medium">{request.title}</p><p className="text-sm text-slate-600">{request.type} · {request.requester.name}</p><p className="text-sm text-slate-600">{request.description || "-"}</p></div><form action={review} className="flex flex-wrap gap-2"><Select name="visibility" label="การมองเห็นเมื่ออนุมัติ" defaultValue="RESIDENT" options={[{ value: "RESIDENT", label: "เฉพาะลูกบ้าน" }, { value: "PUBLIC", label: "สาธารณะ" }]} /><Input name="supportReason" aria-label="เหตุผลในการดำเนินการ" placeholder="เหตุผลในการดำเนินการ" minLength={5} required /><Button name="decision" value="APPROVE" type="submit">อนุมัติ</Button><Button name="decision" value="REJECT" type="submit" variant="danger">ปฏิเสธ</Button></form></div>; })}</section></div>;
}

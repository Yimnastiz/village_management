import { getWorkspaceVillage } from "@/features/village-workspace/server/queries";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

export default async function Page({ params }: { params: Promise<{ villageId: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId } = await params;
  const village = await getWorkspaceVillage(villageId);
  const endpoint = `/api/superadmin/villages/${villageId}/population/export`;

  return <div className="mx-auto max-w-4xl space-y-6"><header><h2 className="text-2xl font-semibold">ส่งออกข้อมูลประชากร</h2><p className="mt-1 text-sm text-slate-500">สร้าง workbook เฉพาะข้อมูลของ {village.name}</p></header><section className="rounded-xl border bg-white p-5"><h3 className="font-semibold">ชุดข้อมูลมาตรฐาน</h3><p className="mt-2 text-sm text-slate-600">ประกอบด้วย Summary, บ้าน, ประชากร และบัญชีสมาชิก โดย query ทุกชุดถูกบังคับด้วย villageId ปัจจุบัน</p><form action={endpoint} method="get" className="mt-5 space-y-3"><label className="block text-sm font-medium">เหตุผลในการดำเนินการ <span className="text-red-600">*</span><input name="supportReason" required minLength={5} maxLength={500} className="mt-1 block w-full rounded-lg border px-3 py-2" placeholder="เช่น ส่งให้ผู้ใหญ่บ้านตรวจสอบทะเบียน" /></label><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">ดาวน์โหลดไฟล์</button></form></section><section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">ไฟล์ส่งออกอาจมีข้อมูลส่วนบุคคล การดาวน์โหลดจะถูกบันทึกใน Audit Log และแจ้งผู้ดูแลหมู่บ้าน</section></div>;
}

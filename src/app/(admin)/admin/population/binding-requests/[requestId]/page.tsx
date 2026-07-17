import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

interface PageProps { params: Promise<{ requestId: string }> }
export default async function Page({ params }: PageProps) {
  const { requestId } = await params;
  const session = await getSessionContextFromServerCookies();
  if (!session || !isAdminUser(session)) redirect("/admin/population");
  const villageIds = session.memberships.filter((item) => item.status === MembershipStatus.ACTIVE && item.role !== VillageMembershipRole.RESIDENT).map((item) => item.villageId);
  const request = await prisma.bindingRequest.findFirst({ where: { id: requestId, villageId: { in: villageIds } }, include: { user: { select: { name: true, phoneNumber: true } }, house: { select: { houseNumber: true } }, village: { select: { name: true } } } });
  if (!request) redirect("/admin/population/binding-requests");
  return <div className="space-y-6"><h1 className="text-2xl font-bold text-gray-900">คำขอผูกบ้าน</h1><div className="rounded-xl border bg-white p-6"><p className="font-medium">{request.user.name} · {request.user.phoneNumber}</p><p className="text-sm text-slate-500">หมู่บ้าน {request.village?.name ?? "-"}</p><p className="mt-3">เลขบ้าน: {request.house?.houseNumber ?? request.houseNumber ?? "-"}</p><p className="mt-2 rounded bg-amber-50 p-3 text-sm text-amber-800">{request.houseId ? "คำขอนี้ผูกเข้าบ้าน master data ที่มีอยู่แล้ว" : "เลขบ้านนี้มาจากคำขอของลูกบ้าน ยังไม่ใช่ข้อมูลบ้านจริงจนกว่าผู้ดูแลจะตรวจสอบและสร้างบ้าน"}</p><p className="mt-2 text-sm">สถานะ: {request.status}</p><p className="mt-4 text-sm text-slate-600">การอนุมัติ/ปฏิเสธทำได้จากหน้า Population เพื่อใช้ transaction และสิทธิ์เดิมของระบบ</p></div></div>;
}

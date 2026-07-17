import Link from "next/link";
import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

export default async function Page() {
  const session = await getSessionContextFromServerCookies();
  if (!session || !isAdminUser(session)) redirect("/admin/population");
  const villageIds = session.memberships.filter((item) => item.status === MembershipStatus.ACTIVE && item.role !== VillageMembershipRole.RESIDENT).map((item) => item.villageId);
  const requests = await prisma.bindingRequest.findMany({ where: { villageId: { in: villageIds } }, orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { name: true } }, house: { select: { houseNumber: true } } } });
  return <div className="space-y-6"><h1 className="text-2xl font-bold text-gray-900">คำขอผูกบ้าน</h1><div className="space-y-2 rounded-xl border bg-white p-6">{requests.length === 0 ? <p className="text-center text-gray-500">ยังไม่มีคำขอ</p> : requests.map((request) => <Link key={request.id} href={`/admin/population/binding-requests/${request.id}`} className="block rounded-lg border p-3 hover:bg-slate-50"><p className="font-medium">{request.user.name} · {request.house?.houseNumber ?? request.houseNumber ?? "-"}</p><p className="text-sm text-slate-500">{request.houseId ? "คำขอผูกเข้าบ้านที่มีอยู่แล้ว" : "เลขบ้านนี้ยังไม่มีในระบบ · รอตรวจสอบ"} · {request.status}</p></Link>)}</div></div>;
}

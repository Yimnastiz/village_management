import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MEMBERSHIP_ROLE_LABELS, MEMBERSHIP_STATUS_LABELS } from "@/lib/constants";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { updateVillageMemberAccessAction } from "../actions";

type PageProps = {
  searchParams?: Promise<{ q?: string; role?: string; status?: string }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/admin/settings/roles");
  if (!isAdminUser(session)) redirect(computeLandingPath(session));

  const membership = await prisma.villageMembership.findFirst({
    where: {
      userId: session.id,
      status: MembershipStatus.ACTIVE,
      role: { in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN, VillageMembershipRole.COMMITTEE] },
    },
    select: { villageId: true },
  });
  if (!membership) redirect(computeLandingPath(session));

  const q = params.q?.trim() ?? "";
  const activeRole = params.role ?? "ALL";
  const activeStatus = params.status ?? "ALL";

  const members = await prisma.villageMembership.findMany({
    where: {
      villageId: membership.villageId,
      ...(activeRole !== "ALL" ? { role: activeRole as VillageMembershipRole } : {}),
      ...(activeStatus !== "ALL" ? { status: activeStatus as MembershipStatus } : {}),
      ...(q
        ? {
            OR: [
              { user: { name: { contains: q, mode: "insensitive" } } },
              { user: { phoneNumber: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      user: { select: { id: true, name: true, phoneNumber: true } },
      house: { select: { houseNumber: true } },
    },
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ตั้งค่าสิทธิ์</h1>
        <p className="mt-1 text-sm text-gray-500">ปรับ role และสถานะสมาชิกในหมู่บ้านแบบเรียลไทม์</p>
      </div>

      <form method="get" className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <input name="q" defaultValue={q} placeholder="ค้นหาชื่อ/เบอร์โทร" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <select name="role" defaultValue={activeRole} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="ALL">ทุก role</option>
            {Object.keys(MEMBERSHIP_ROLE_LABELS).map((role) => (
              <option key={role} value={role}>{MEMBERSHIP_ROLE_LABELS[role]}</option>
            ))}
          </select>
          <select name="status" defaultValue={activeStatus} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="ALL">ทุกสถานะ</option>
            {Object.keys(MEMBERSHIP_STATUS_LABELS).map((status) => (
              <option key={status} value={status}>{MEMBERSHIP_STATUS_LABELS[status]}</option>
            ))}
          </select>
          <Button type="submit" variant="outline">ค้นหา</Button>
        </div>
      </form>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3">ผู้ใช้งาน</th>
              <th className="px-4 py-3">บ้านเลขที่</th>
              <th className="px-4 py-3">สถานะปัจจุบัน</th>
              <th className="px-4 py-3">ปรับสิทธิ์</th>
            </tr>
          </thead>
          <tbody>
            {members.map((item) => (
              <tr key={item.id} className="border-t border-gray-100 align-top">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{item.user.name}</p>
                  <p className="text-xs text-gray-500">{item.user.phoneNumber}</p>
                </td>
                <td className="px-4 py-3 text-gray-700">{item.house?.houseNumber ?? "-"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{MEMBERSHIP_ROLE_LABELS[item.role]}</Badge>
                    <Badge variant={item.status === MembershipStatus.ACTIVE ? "success" : "warning"}>
                      {MEMBERSHIP_STATUS_LABELS[item.status]}
                    </Badge>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <form action={updateVillageMemberAccessAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="membershipId" value={item.id} />
                    <select name="role" defaultValue={item.role} className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs">
                      {Object.keys(MEMBERSHIP_ROLE_LABELS).map((role) => (
                        <option key={role} value={role}>{MEMBERSHIP_ROLE_LABELS[role]}</option>
                      ))}
                    </select>
                    <select name="status" defaultValue={item.status} className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs">
                      {Object.keys(MEMBERSHIP_STATUS_LABELS).map((status) => (
                        <option key={status} value={status}>{MEMBERSHIP_STATUS_LABELS[status]}</option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" variant="outline">บันทึก</Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

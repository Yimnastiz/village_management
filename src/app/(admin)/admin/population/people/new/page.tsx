import { redirect } from "next/navigation";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PersonForm } from "../person-form";

export default async function NewPersonPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/admin/population/people/new");
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

  const houses = await prisma.house.findMany({
    where: { villageId: membership.villageId },
    orderBy: [{ houseNumber: "asc" }],
    select: { id: true, houseNumber: true },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">เพิ่มข้อมูลบุคคล</h1>
        <p className="mt-1 text-sm text-gray-500">สร้างข้อมูลบุคคลใหม่ในทะเบียนประชากร</p>
      </div>
      <PersonForm
        mode="create"
        houseOptions={houses.map((house) => ({ value: house.id, label: house.houseNumber }))}
      />
    </div>
  );
}

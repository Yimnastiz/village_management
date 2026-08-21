import { redirect } from "next/navigation";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PersonForm } from "../person-form";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { isThaiNationalIdChecksumBypassEnabled } from "@/lib/thai-identity";

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
    <div data-admin-compact-top className="space-y-3">
      <AdminPageToolbar variant="form" backHref="/admin/population/people" backLabel="กลับทะเบียนประชากร" backPlacement="header-end" title="เพิ่มข้อมูลบุคคล" description="สร้างข้อมูลบุคคลใหม่ในทะเบียนประชากร" />
      <PersonForm
        mode="create"
        houseOptions={houses.map((house) => ({ value: house.id, label: house.houseNumber }))}
        allowNationalIdChecksumBypass={isThaiNationalIdChecksumBypassEnabled()}
      />
    </div>
  );
}

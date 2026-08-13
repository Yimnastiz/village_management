import { notFound, redirect } from "next/navigation";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PersonForm } from "../../person-form";

interface PageProps {
  params: Promise<{ personId: string }>;
}

function toInputDate(value: Date | null): string {
  if (!value) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function EditPersonPage({ params }: PageProps) {
  const { personId } = await params;
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/admin/population/people");
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

  const [person, houses] = await Promise.all([
    prisma.person.findFirst({
      where: { id: personId, villageId: membership.villageId },
    }),
    prisma.house.findMany({
      where: { villageId: membership.villageId },
      orderBy: [{ houseNumber: "asc" }],
      select: { id: true, houseNumber: true },
    }),
  ]);

  if (!person) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">แก้ไขข้อมูลบุคคล</h1>
        <p className="mt-1 text-sm text-gray-500">ปรับปรุงข้อมูลทะเบียนประชากร</p>
      </div>
      <PersonForm
        mode="edit"
        personId={person.id}
        houseOptions={houses.map((house) => ({ value: house.id, label: house.houseNumber }))}
        defaultValues={{
          firstName: person.firstName,
          lastName: person.lastName,
          nationalId: person.nationalId ?? "",
          dateOfBirth: toInputDate(person.dateOfBirth),
          gender: person.gender ?? "",
          phone: person.phone ?? "",
          email: person.email ?? "",
          houseId: person.houseId ?? "",
        }}
        identityLocked={Boolean(person.userId)}
        movedOut={person.status === "MOVED_OUT"}
      />
    </div>
  );
}

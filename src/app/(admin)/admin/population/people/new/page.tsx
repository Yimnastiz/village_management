import { redirect } from "next/navigation";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { PersonForm } from "../person-form";

export default async function NewPersonPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: {
      userId: session.id,
      status: "ACTIVE",
      role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] },
    },
    select: { villageId: true },
  });
  if (!membership) redirect("/resident");

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

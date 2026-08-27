import { notFound, redirect } from "next/navigation";
import { getVillagePermissionContext } from "@/lib/admin-permission.server";
import { prisma } from "@/lib/prisma";
import { PersonForm } from "../../person-form";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { normalizePersonGender } from "@/lib/person-validation";
import { isThaiNationalIdChecksumBypassEnabled } from "@/lib/thai-identity";

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
  const context = await getVillagePermissionContext("population.person.manage");
  if (!context) redirect("/auth/login?callbackUrl=/admin/population/people");
  const membership = context.membership;

  const [person, houses] = await Promise.all([
    prisma.person.findFirst({
      where: { id: personId, villageId: membership.villageId },
      include: { user: { select: { phoneNumber: true, email: true } } },
    }),
    prisma.house.findMany({
      where: { villageId: membership.villageId },
      orderBy: [{ houseNumber: "asc" }],
      select: { id: true, houseNumber: true },
    }),
  ]);

  if (!person) notFound();
  if (person.status === "MOVED_OUT" || person.status === "DECEASED") {
    redirect(`/admin/population/people/${person.id}`);
  }

  return (
    <div data-admin-compact-top className="space-y-3">
      <AdminPageToolbar variant="form" backHref={`/admin/population/people/${person.id}`} backLabel="กลับรายละเอียดบุคคล" backPlacement="header-end" title="แก้ไขข้อมูลบุคคล" description="ปรับปรุงข้อมูลทะเบียน โดยแยกจากข้อมูลเข้าสู่ระบบของบัญชีผู้ใช้" />
      <PersonForm
        mode="edit"
        personId={person.id}
        houseOptions={houses.map((house) => ({ value: house.id, label: house.houseNumber }))}
        defaultValues={{
          firstName: person.firstName,
          lastName: person.lastName,
          nationalId: person.nationalId ?? "",
          dateOfBirth: toInputDate(person.dateOfBirth),
          gender: normalizePersonGender(person.gender) ?? "ไม่ระบุ",
          phone: person.phone ?? "",
          email: person.email ?? "",
          houseId: person.houseId ?? "",
        }}
        linkedAccount={person.user ? { phoneNumber: person.user.phoneNumber, email: person.user.email?.endsWith("@local.invalid") ? null : person.user.email } : null}
        movedOut={false}
        deceased={false}
        allowNationalIdChecksumBypass={isThaiNationalIdChecksumBypassEnabled()}
      />
    </div>
  );
}

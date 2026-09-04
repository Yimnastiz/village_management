import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { UserDetailClient } from "../user-detail-client";

type PageProps = {
  params: Promise<{ userId: string }>;
};

export default async function SuperAdminUserDetailPage({ params }: PageProps) {
  await requireSuperAdminPageSession();
  const { userId } = await params;

  const [user, memberships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        email: true,
        systemRole: true,
        accountStatus: true,
        registrationProvince: true,
        registrationDistrict: true,
        registrationSubdistrict: true,
        registrationVillage: { select: { name: true } },
        person: { select: { id: true, villageId: true, firstName: true, lastName: true } },
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.villageMembership.findMany({
      where: { userId },
      select: {
        id: true,
        villageId: true,
        role: true,
        status: true,
        joinedAt: true,
        village: { select: { id: true, name: true, moo: true, subdistrict: true, district: true, province: true } },
        house: { select: { houseNumber: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
  ]);

  if (!user) {
    notFound();
  }

  return (
    <UserDetailClient
      user={{
        ...user,
        displayName: user.person ? `${user.person.firstName} ${user.person.lastName}`.trim() : user.name,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        linkedPersonId: user.person?.id ?? null,
      }}
      memberships={memberships.map((membership) => ({
        id: membership.id,
        villageId: membership.villageId,
        role: membership.role,
        status: membership.status,
        joinedAt: membership.joinedAt?.toISOString() ?? null,
        village: membership.village,
        houseNumber: membership.house?.houseNumber ?? null,
        personId: user.person?.villageId === membership.villageId ? user.person.id : null,
      }))}
    />
  );
}

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

  const [user, villages, memberships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        email: true,
        image: true,
        systemRole: true,
        registrationProvince: true,
        registrationDistrict: true,
        registrationSubdistrict: true,
      },
    }),
    prisma.village.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.villageMembership.findMany({
      where: { userId },
      include: { village: { select: { name: true } } },
      orderBy: [{ updatedAt: "desc" }],
    }),
  ]);

  if (!user) {
    notFound();
  }

  return (
    <UserDetailClient
      user={{ ...user, systemRole: user.systemRole }}
      villages={villages}
      memberships={memberships.map((membership) => ({
        id: membership.id,
        villageId: membership.villageId,
        villageName: membership.village.name,
        role: membership.role,
        status: membership.status,
        houseId: membership.houseId,
      }))}
    />
  );
}

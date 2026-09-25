import { redirect } from "next/navigation";
import { AccountEmailStatus } from "@prisma/client";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { HouseAccountProfile } from "./house-account-profile";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/resident/profile");
  if (!getResidentMembership(session)) redirect("/");

  const houseAccount = await prisma.residentHouseAccount.findUnique({
    where: { userId: session.id },
    include: {
      house: { select: { houseNumber: true } },
      village: { select: { name: true, moo: true } },
      _count: { select: { accountEmails: { where: { status: AccountEmailStatus.ACTIVE } } } },
    },
  });

  if (!houseAccount?.activatedAt || houseAccount.suspendedAt) redirect("/");

  return (
    <HouseAccountProfile
      houseNumber={houseAccount.house.houseNumber}
      villageName={houseAccount.village.name}
      moo={houseAccount.village.moo}
      contactPhone={houseAccount.contactPhone}
      activeEmailCount={houseAccount._count.accountEmails}
    />
  );
}

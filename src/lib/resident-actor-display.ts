import { AccountKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
export { residentActorDisplay, type ResidentActorDisplay } from "@/lib/resident-actor-display-core";
import { residentActorDisplay, type ResidentActorDisplay } from "@/lib/resident-actor-display-core";

export const RESIDENT_ACTOR_USER_SELECT = {
  id: true,
  accountKind: true,
  name: true,
  phoneNumber: true,
  residentHouseAccount: {
    select: {
      villageId: true,
      contactPhone: true,
      house: { select: { houseNumber: true } },
    },
  },
} satisfies Prisma.UserSelect;

export type ResidentActorUser = Prisma.UserGetPayload<{
  select: typeof RESIDENT_ACTOR_USER_SELECT;
}>;

export async function getResidentActorDisplayByUserId(
  userId: string,
  options: { villageId?: string | null } = {},
): Promise<ResidentActorDisplay> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: RESIDENT_ACTOR_USER_SELECT,
  });
  if (process.env.NODE_ENV === "development" && user?.accountKind === AccountKind.RESIDENT_HOUSE && !user.residentHouseAccount) {
    console.warn("[resident-actor-display] RESIDENT_HOUSE is missing ResidentHouseAccount", { userId });
  }
  return residentActorDisplay(user, options);
}

import { redirect } from "next/navigation";
import { getSessionContextFromServerCookies, setActiveVillageForCurrentSession } from "@/lib/access-control";

export default async function ResidentRootPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    redirect("/auth/login?callbackUrl=/resident");
  }

  const residentMemberships = session.memberships.filter(
    (membership) => membership.role === "RESIDENT" && membership.status === "ACTIVE"
  );

  if (residentMemberships.length === 0) {
    redirect("/resident/dashboard");
  }

  const activeMembership = residentMemberships.find(
    (membership) => membership.villageId === session.activeVillageId,
  ) ?? residentMemberships[0];

  if (activeMembership && session.activeVillageId !== activeMembership.villageId) {
    await setActiveVillageForCurrentSession(activeMembership.villageId);
  }

  redirect("/resident/dashboard");
}

import { redirect } from "next/navigation";
import { NotificationStatus } from "@prisma/client";
import { ResidentSidebar } from "@/components/layout/resident-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { ResidentPageHeaderProvider } from "@/components/layout/resident-page-header-context";
import { prisma } from "@/lib/prisma";
import {
  getAuthenticatedAccessRedirectPath,
  getResidentMembership,
  getSessionContextFromServerCookies,
  isAdminUser,
} from "@/lib/access-control";
import { getPendingResidentContextFromServerCookies } from "@/lib/pending-resident-access";
import { getSystemSettings } from "@/lib/system-settings";
import { MaintenanceNotice } from "@/components/system/maintenance-notice";
import { RESIDENT_ACTOR_USER_SELECT, residentActorDisplay } from "@/lib/resident-actor-display";

export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContextFromServerCookies();
  if (session && isAdminUser(session)) {
    redirect(await getAuthenticatedAccessRedirectPath(session));
  }

  const pendingResident = session ? null : await getPendingResidentContextFromServerCookies();
  if (!session && !pendingResident) redirect("/auth/login?callbackUrl=/resident");

  const systemSettings = await getSystemSettings();
  if (systemSettings.maintenanceMode) return <MaintenanceNotice message={systemSettings.maintenanceMessage} />;

  const residentMembership = session ? getResidentMembership(session) : null;
  if (session && !residentMembership) redirect("/");

  if (pendingResident) {
    const publicVillage = await prisma.village.findUnique({
      where: { id: pendingResident.villageId },
      select: { id: true, name: true, slug: true, moo: true },
    });
    if (!publicVillage) redirect("/auth/register");
    const residentNavigationState = {
      accessMode: "PENDING" as const,
      hasMembership: false,
      isHouseAccount: false,
      publicVillageBasePath: publicVillage.slug ? `/${publicVillage.slug}` : null,
    };
    return (
      <div className="flex min-h-screen bg-gray-50 [--app-sticky-top:var(--app-topbar-visible-offset,4rem)]">
        <ResidentSidebar state={residentNavigationState} />
        <ResidentPageHeaderProvider>
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar userArea="resident" userName={pendingResident.applicantName} userIdentityKind="HOUSE" unreadNotificationCount={0} villageName={publicVillage.name} villageMoo={publicVillage.moo} residentNavigationState={residentNavigationState} />
            <main className="flex-1 p-4 sm:p-6">{children}</main>
          </div>
        </ResidentPageHeaderProvider>
      </div>
    );
  }

  if (!session || !residentMembership) redirect("/auth/login");

  const [userProfile, unreadNotificationCount, villageProfile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.id },
      select: {
        ...RESIDENT_ACTOR_USER_SELECT,
        image: true,
      },
    }),
    prisma.notification.count({
      where: {
        userId: session.id,
        villageId: session.activeVillageId ?? undefined,
        status: NotificationStatus.UNREAD,
      },
    }),
    prisma.village.findUnique({
      where: { id: residentMembership.villageId },
      select: { id: true, name: true, slug: true, moo: true, province: true, district: true, subdistrict: true },
    }),
  ]);

  const publicVillage = villageProfile;
  const actorDisplay = residentActorDisplay(userProfile, { villageId: session.activeVillageId });
  const residentNavigationState = {
    accessMode: "ACTIVE" as const,
    hasMembership: Boolean(residentMembership),
    isHouseAccount: true,
    publicVillageBasePath: publicVillage?.slug ? `/${publicVillage.slug}` : null,
  };

  return (
    <div className="flex min-h-screen bg-gray-50 [--app-sticky-top:var(--app-topbar-visible-offset,4rem)]">
      <ResidentSidebar state={residentNavigationState} />
      <ResidentPageHeaderProvider>
      <div className="flex-1 flex min-w-0 flex-col">
        <TopBar
          userArea="resident"
          userName={actorDisplay.label}
          userImageUrl={null}
          userIdentityKind="HOUSE"
          unreadNotificationCount={unreadNotificationCount}
          villageName={publicVillage?.name ?? null}
          villageMoo={publicVillage?.moo ?? null}
          residentNavigationState={residentNavigationState}
        />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
      </ResidentPageHeaderProvider>
    </div>
  );
}

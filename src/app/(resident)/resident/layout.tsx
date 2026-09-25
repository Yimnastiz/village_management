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
import { getSystemSettings } from "@/lib/system-settings";
import { MaintenanceNotice } from "@/components/system/maintenance-notice";
import { RESIDENT_ACTOR_USER_SELECT, residentActorDisplay } from "@/lib/resident-actor-display";

export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContextFromServerCookies();

  if (!session) {
    redirect("/auth/login?callbackUrl=/resident");
  }

  if (isAdminUser(session)) {
    redirect(await getAuthenticatedAccessRedirectPath(session));
  }

  const systemSettings = await getSystemSettings();
  if (systemSettings.maintenanceMode) return <MaintenanceNotice message={systemSettings.maintenanceMessage} />;

  const residentMembership = getResidentMembership(session);
  if (!residentMembership) redirect("/");

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

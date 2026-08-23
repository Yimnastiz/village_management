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

export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContextFromServerCookies();

  if (!session) {
    redirect("/auth/login?callbackUrl=/resident");
  }

  if (isAdminUser(session)) {
    redirect(await getAuthenticatedAccessRedirectPath(session));
  }

  const residentMembership = getResidentMembership(session);
  const latestBindingRequest = residentMembership
    ? null
    : await prisma.bindingRequest.findFirst({
        where: {
          userId: session.id,
        },
        select: { id: true, status: true, reviewNote: true },
        orderBy: { createdAt: "desc" },
      });

  const [userProfile, unreadNotificationCount, villageProfile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.id },
      select: {
        name: true,
        image: true,
        registrationVillage: { select: { id: true, slug: true, name: true, moo: true, province: true, district: true, subdistrict: true } },
      },
    }),
    prisma.notification.count({
      where: {
        userId: session.id,
        status: NotificationStatus.UNREAD,
      },
    }),
    residentMembership
      ? prisma.village.findUnique({
          where: { id: residentMembership.villageId },
          select: { id: true, name: true, slug: true, moo: true, province: true, district: true, subdistrict: true },
        })
      : Promise.resolve(null),
  ]);

  const publicVillage = residentMembership
    ? villageProfile
    : userProfile?.registrationVillage ?? null;
  const residentNavigationState = {
    hasMembership: Boolean(residentMembership),
    bindingRequestHref: residentMembership
      ? null
      : latestBindingRequest?.status === "PENDING"
        ? "/resident/binding/pending"
        : "/resident/binding",
    bindingStatus: latestBindingRequest?.status ?? null,
    bindingRejectReason:
      latestBindingRequest?.status === "REJECTED"
        ? latestBindingRequest.reviewNote
        : null,
    publicVillageBasePath: publicVillage?.slug ? `/${publicVillage.slug}` : null,
  };

  return (
    <div className="flex min-h-screen bg-gray-50 [--app-sticky-top:var(--app-topbar-visible-offset,4rem)]">
      <ResidentSidebar state={residentNavigationState} />
      <ResidentPageHeaderProvider>
      <div className="flex-1 flex min-w-0 flex-col">
        <TopBar
          userArea="resident"
          userName={userProfile?.name || session.name}
          userImageUrl={userProfile?.image ?? null}
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

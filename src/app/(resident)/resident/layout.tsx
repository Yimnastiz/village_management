import { redirect } from "next/navigation";
import { NotificationStatus } from "@prisma/client";
import { ResidentSidebar } from "@/components/layout/resident-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { ToastProvider } from "@/components/ui/toast";
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
        registrationVillage: { select: { slug: true, name: true } },
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
          select: { name: true, slug: true },
        })
      : Promise.resolve(null),
  ]);

  const publicVillage = residentMembership
    ? villageProfile
    : userProfile?.registrationVillage ?? null;
  const residentNavigationState = {
    hasMembership: Boolean(residentMembership),
    bindingRequestHref:
      latestBindingRequest?.status === "PENDING"
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
    <div className="flex min-h-screen bg-gray-50">
      <ResidentSidebar state={residentNavigationState} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          userArea="resident"
          userName={userProfile?.name || session.name}
          userImageUrl={userProfile?.image ?? null}
          unreadNotificationCount={unreadNotificationCount}
          villageName={publicVillage?.name ?? null}
          residentNavigationState={residentNavigationState}
        />
        <ToastProvider>
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </ToastProvider>
      </div>
    </div>
  );
}

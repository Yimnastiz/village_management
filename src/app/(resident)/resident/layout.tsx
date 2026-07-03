import { redirect } from "next/navigation";
import { NotificationStatus } from "@prisma/client";
import { ResidentSidebar } from "@/components/layout/resident-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { prisma } from "@/lib/prisma";
import {
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
    redirect("/admin/dashboard");
  }

  const residentMembership = getResidentMembership(session);
  const pendingBindingRequest = residentMembership
    ? null
    : await prisma.bindingRequest.findFirst({
        where: {
          userId: session.id,
          status: "PENDING",
        },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });

  const residentNavigationState = {
    hasMembership: Boolean(residentMembership),
    pendingBindingRequestHref: pendingBindingRequest ? "/resident/binding/pending" : "/resident/binding",
  };

  const [userProfile, unreadNotificationCount, villageProfile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.id },
      select: { name: true, image: true },
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
          select: { name: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <ResidentSidebar state={residentNavigationState} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          userArea="resident"
          userName={userProfile?.name || session.name}
          userImageUrl={userProfile?.image ?? null}
          unreadNotificationCount={unreadNotificationCount}
          villageName={villageProfile?.name ?? null}
          residentNavigationState={residentNavigationState}
        />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

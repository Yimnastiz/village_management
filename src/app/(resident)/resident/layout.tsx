import { redirect } from "next/navigation";
import { NotificationStatus } from "@prisma/client";
import { ResidentSidebar } from "@/components/layout/resident-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { prisma } from "@/lib/prisma";
import {
  computeLandingPath,
  getResidentMembership,
  getSessionContextFromServerCookies,
  isAdminUser,
  isResidentUser,
} from "@/lib/access-control";

export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContextFromServerCookies();

  if (!session) {
    redirect("/auth/login?callbackUrl=/resident");
  }

  if (isAdminUser(session)) {
    redirect(computeLandingPath(session));
  }

  if (!isResidentUser(session)) {
    redirect("/auth/binding");
  }

  const residentMembership = getResidentMembership(session);

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
      <ResidentSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          userArea="resident"
          userName={userProfile?.name || session.name}
          userImageUrl={userProfile?.image ?? null}
          unreadNotificationCount={unreadNotificationCount}
          villageName={villageProfile?.name ?? null}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

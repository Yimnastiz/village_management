import { redirect } from "next/navigation";
import { NotificationStatus } from "@prisma/client";
import { ResidentSidebar } from "@/components/layout/resident-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { prisma } from "@/lib/prisma";
import {
  computeLandingPath,
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

  const [userProfile, unreadNotificationCount] = await Promise.all([
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
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

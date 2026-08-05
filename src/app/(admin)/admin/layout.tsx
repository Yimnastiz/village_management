import { redirect } from "next/navigation";
import { NotificationStatus } from "@prisma/client";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { ToastProvider } from "@/components/ui/toast";
import { prisma } from "@/lib/prisma";
import {
  getAuthenticatedAccessRedirectPath,
  getAdminMembership,
  getSessionContextFromServerCookies,
  isAdminUser,
} from "@/lib/access-control";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContextFromServerCookies();

  if (!session) {
    redirect("/auth/login?callbackUrl=/admin");
  }

  const adminMembership = getAdminMembership(session);
  if (!adminMembership || !isAdminUser(session)) {
    redirect(await getAuthenticatedAccessRedirectPath(session));
  }

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
    prisma.village.findUnique({
      where: { id: adminMembership.villageId },
      select: { name: true },
    }),
  ]);

  const villageName = villageProfile?.name ?? null;

  return (
    <div className="flex min-h-screen bg-gray-100">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          userArea="admin"
          userName={userProfile?.name || session.name}
          userImageUrl={userProfile?.image ?? null}
          unreadNotificationCount={unreadNotificationCount}
          villageName={villageName}
        />
        <ToastProvider>
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </ToastProvider>
      </div>
    </div>
  );
}

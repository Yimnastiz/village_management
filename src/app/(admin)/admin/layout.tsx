import { redirect } from "next/navigation";
import { NotificationStatus } from "@prisma/client";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { prisma } from "@/lib/prisma";
import {
  getAuthenticatedAccessRedirectPath,
  getAdminMembership,
  getSessionContextFromServerCookies,
  isAdminUser,
} from "@/lib/access-control";
import { MEMBERSHIP_ROLE_LABELS } from "@/lib/constants";
import { getVillageDisplayName } from "@/lib/village-display-name.server";
import { getAdminSidebarActionCounts } from "@/lib/admin-sidebar-action-counts";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContextFromServerCookies();

  if (!session) {
    redirect("/auth/login?callbackUrl=/admin");
  }

  const adminMembership = getAdminMembership(session);
  if (!adminMembership || !isAdminUser(session)) {
    redirect(await getAuthenticatedAccessRedirectPath(session));
  }

  const [userProfile, unreadNotificationCount, villageProfile, sidebarActionCounts] = await Promise.all([
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
      select: { id: true, name: true, moo: true, province: true, district: true, subdistrict: true },
    }),
    getAdminSidebarActionCounts(adminMembership.villageId),
  ]);

  const villageName = villageProfile ? await getVillageDisplayName(villageProfile) : null;

  return (
    <div className="flex min-h-screen bg-gray-100 [--app-sticky-top:var(--app-topbar-visible-offset,4rem)]">
      <AdminSidebar actionCounts={sidebarActionCounts} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          userArea="admin"
          userName={userProfile?.name || session.name}
          userImageUrl={userProfile?.image ?? null}
          unreadNotificationCount={unreadNotificationCount}
          adminActionCounts={sidebarActionCounts}
          villageName={villageName}
          adminRoleLabel={MEMBERSHIP_ROLE_LABELS[adminMembership.role] ?? "ผู้ใหญ่บ้าน"}
        />
        <main className="flex-1 p-4 has-[>div[data-admin-compact-top]]:min-h-0 has-[>div[data-admin-compact-top]]:pt-2 sm:p-6 sm:has-[>div[data-admin-compact-top]]:pt-2">{children}</main>
      </div>
    </div>
  );
}

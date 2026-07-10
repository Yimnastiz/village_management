import { NotificationStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { SuperAdminSidebar } from "@/components/layout/superadmin-sidebar";
import { SuperAdminTopBar } from "@/components/layout/superadmin-top-bar";
import { ToastProvider } from "@/components/ui/toast";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSuperAdminPageSession();

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

  if (!session) {
    redirect("/auth/login?callbackUrl=/superadmin/dashboard");
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-slate-100">
        <SuperAdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <SuperAdminTopBar
            userName={userProfile?.name ?? session.name}
            unreadNotificationCount={unreadNotificationCount}
          />
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}

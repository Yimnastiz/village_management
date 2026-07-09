import { NotificationStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/layout/logout-button";
import { SuperAdminSidebar } from "@/components/layout/superadmin-sidebar";
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
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm md:px-6">
            <div>
              <p className="text-sm font-semibold text-slate-900">Super Admin Control Center</p>
              <p className="text-xs text-slate-500">แจ้งเตือนที่ยังไม่อ่าน: {unreadNotificationCount}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">{userProfile?.name ?? session.name}</p>
                <p className="text-xs text-slate-500">SUPERADMIN</p>
              </div>
              <LogoutButton />
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}

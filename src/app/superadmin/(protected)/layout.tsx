import { SuperAdminSidebar } from "@/components/layout/superadmin-sidebar";
import { SuperAdminTopBar } from "@/components/layout/superadmin-top-bar";
import { SuperAdminPageHeaderProvider } from "@/components/layout/superadmin-page-header-context";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

export default async function ProtectedSuperAdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdminPageSession();

  return (
    <div className="flex min-h-screen bg-slate-100">
      <SuperAdminSidebar />
      <SuperAdminPageHeaderProvider>
        <div className="flex min-w-0 flex-1 flex-col">
          <SuperAdminTopBar />
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </SuperAdminPageHeaderProvider>
    </div>
  );
}

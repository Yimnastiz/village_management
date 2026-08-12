import { SuperAdminSidebar } from "@/components/layout/superadmin-sidebar";
import { SuperAdminTopBar } from "@/components/layout/superadmin-top-bar";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdminPageSession();

  return (
    <div className="flex min-h-screen bg-slate-100">
        <SuperAdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <SuperAdminTopBar />
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
    </div>
  );
}

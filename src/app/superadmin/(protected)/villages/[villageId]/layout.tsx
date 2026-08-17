import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { getWorkspaceVillage } from "@/features/village-workspace/server/queries";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { SuperAdminVillageSidebar } from "./superadmin-village-sidebar";
import { WorkspaceToast } from "./workspace-toast";

export default async function VillageWorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ villageId: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId } = await params;
  const village = await getWorkspaceVillage(villageId);
  const displayName = `${village.moo ? `หมู่ ${village.moo} ` : ""}${village.name}`;
  const location = `ต.${village.subdistrict ?? "-"} · อ.${village.district ?? "-"} · จ.${village.province ?? "-"}`;

  return (
    <div className="-m-4 flex min-w-0 sm:-m-6">
      <SuperAdminPageHeaderRegistration context={{ title: displayName, workspace: { villageId, location, isActive: village.isActive } }} />
      <SuperAdminVillageSidebar villageId={villageId} />
      <div className="min-w-0 flex-1 p-4 sm:p-6">
        <WorkspaceToast />
        {children}
      </div>
    </div>
  );
}

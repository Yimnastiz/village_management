import { AdminPageHeaderRegistration } from "@/components/layout/admin-page-header-context";
import { SettingsNavigation } from "./settings-navigation";
import { requireVillagePagePermission } from "@/lib/admin-permission.server";
import { hasVillagePermission } from "@/lib/village-permissions";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { membership } = await requireVillagePagePermission("members.view");
  return <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
    <AdminPageHeaderRegistration context={{ title: "ตั้งค่า", description: "จัดการข้อมูลส่วนตัว ข้อมูลหมู่บ้าน และสิทธิ์การใช้งาน" }} />
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch">
      <SettingsNavigation canManageVillage={hasVillagePermission(membership.role, "village.settings.manage")} />
      <main className="min-h-0 min-w-0 flex-1">{children}</main>
    </div>
  </div>;
}

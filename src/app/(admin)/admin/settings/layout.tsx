import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { SettingsNavigation } from "./settings-navigation";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <div data-admin-compact-top className="flex h-full min-h-0 flex-1 flex-col gap-4">
    <AdminPageToolbar title="ตั้งค่า" description="จัดการข้อมูลส่วนตัว ข้อมูลหมู่บ้าน และสิทธิ์การใช้งาน" sticky />
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch">
      <SettingsNavigation />
      <main className="min-h-0 min-w-0 flex-1">{children}</main>
    </div>
  </div>;
}

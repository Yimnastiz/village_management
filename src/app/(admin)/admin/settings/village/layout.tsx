import { AdminRouteHeader } from "@/components/admin/admin-route-header";
import { requireVillagePagePermission } from "@/lib/admin-permission.server";
export default async function Layout({ children }: { children: React.ReactNode }) { await requireVillagePagePermission("village.settings.manage"); return <AdminRouteHeader title="ข้อมูลหมู่บ้าน" priority={2}>{children}</AdminRouteHeader>; }

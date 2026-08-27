import { AdminRouteHeader } from "@/components/admin/admin-route-header";
import { requireVillagePagePermission } from "@/lib/admin-permission.server";
export default async function Layout({ children }: { children: React.ReactNode }) { await requireVillagePagePermission("village.settings.manage"); return <AdminRouteHeader title="การเชื่อมต่อระบบ" priority={2}>{children}</AdminRouteHeader>; }

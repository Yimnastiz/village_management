import { AdminRouteHeader } from "@/components/admin/admin-route-header";
import { requireVillagePagePermission } from "@/lib/admin-permission.server";
export default async function Layout({ children }: { children: React.ReactNode }) { await requireVillagePagePermission("issues.manage"); return <AdminRouteHeader title="จัดการการแจ้งปัญหา">{children}</AdminRouteHeader>; }

import { AdminRouteHeader } from "@/components/admin/admin-route-header";
import { requireVillagePagePermission } from "@/lib/admin-permission.server";
export default async function Layout({ children }: { children: React.ReactNode }) { await requireVillagePagePermission("members.view"); return <AdminRouteHeader title="การเข้าถึงระบบ" priority={2}>{children}</AdminRouteHeader>; }

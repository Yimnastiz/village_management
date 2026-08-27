import { AdminRouteHeader } from "@/components/admin/admin-route-header";
import { requireVillagePagePermission } from "@/lib/admin-permission.server";
export default async function Layout({ children }: { children: React.ReactNode }) { await requireVillagePagePermission("population.view"); return <AdminRouteHeader title="ทะเบียนครัวเรือน">{children}</AdminRouteHeader>; }

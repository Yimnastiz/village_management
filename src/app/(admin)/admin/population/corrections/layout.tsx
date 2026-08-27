import { AdminRouteHeader } from "@/components/admin/admin-route-header";
import { requireVillagePagePermission } from "@/lib/admin-permission.server";
export default async function Layout({ children }: { children: React.ReactNode }) { await requireVillagePagePermission("population.corrections.review"); return <AdminRouteHeader title="คำขอแก้ไขข้อมูลครัวเรือน" priority={2}>{children}</AdminRouteHeader>; }

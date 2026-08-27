import { AdminRouteHeader } from "@/components/admin/admin-route-header";
import { requireVillagePagePermission } from "@/lib/admin-permission.server";
export default async function Layout({ children }: { children: React.ReactNode }) { await requireVillagePagePermission("contacts.manage"); return <AdminRouteHeader title="จัดการข้อมูลติดต่อ">{children}</AdminRouteHeader>; }

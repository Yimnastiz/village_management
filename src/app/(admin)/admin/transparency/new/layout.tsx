import { AdminRouteHeader } from "@/components/admin/admin-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <AdminRouteHeader title="เพิ่มข้อมูลความโปร่งใส" priority={2}>{children}</AdminRouteHeader>; }

import { AdminRouteHeader } from "@/components/admin/admin-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <AdminRouteHeader title="แก้ไขข่าว" priority={3}>{children}</AdminRouteHeader>; }

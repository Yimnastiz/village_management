import { AdminRouteHeader } from "@/components/admin/admin-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <AdminRouteHeader title="เพิ่มข่าว" priority={2}>{children}</AdminRouteHeader>; }

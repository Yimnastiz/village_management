import { AdminRouteHeader } from "@/components/admin/admin-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <AdminRouteHeader title="ข้อมูลหมู่บ้าน" priority={2}>{children}</AdminRouteHeader>; }

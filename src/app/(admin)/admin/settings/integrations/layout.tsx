import { AdminRouteHeader } from "@/components/admin/admin-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <AdminRouteHeader title="การเชื่อมต่อระบบ" priority={2}>{children}</AdminRouteHeader>; }

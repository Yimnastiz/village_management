import { AdminRouteHeader } from "@/components/admin/admin-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <AdminRouteHeader title="รายละเอียดคำขอข้อมูลติดต่อ" priority={3}>{children}</AdminRouteHeader>; }

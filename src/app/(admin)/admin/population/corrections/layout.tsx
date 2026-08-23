import { AdminRouteHeader } from "@/components/admin/admin-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <AdminRouteHeader title="คำขอแก้ไขข้อมูลครัวเรือน" priority={2}>{children}</AdminRouteHeader>; }

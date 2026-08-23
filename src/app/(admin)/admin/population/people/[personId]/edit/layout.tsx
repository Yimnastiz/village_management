import { AdminRouteHeader } from "@/components/admin/admin-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <AdminRouteHeader title="แก้ไขข้อมูลบุคคล" priority={4}>{children}</AdminRouteHeader>; }

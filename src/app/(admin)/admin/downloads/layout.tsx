import { AdminRouteHeader } from "@/components/admin/admin-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <AdminRouteHeader title="จัดการเอกสารดาวน์โหลด">{children}</AdminRouteHeader>; }

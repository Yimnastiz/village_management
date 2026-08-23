import { ResidentRouteHeader } from "@/components/resident/resident-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <ResidentRouteHeader title="แก้ไขการแจ้งปัญหา" priority={1}>{children}</ResidentRouteHeader>; }

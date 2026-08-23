import { ResidentRouteHeader } from "@/components/resident/resident-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <ResidentRouteHeader title="รายละเอียดการแจ้งปัญหา" priority={2}>{children}</ResidentRouteHeader>; }

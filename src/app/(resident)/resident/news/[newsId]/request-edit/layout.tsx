import { ResidentRouteHeader } from "@/components/resident/resident-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <ResidentRouteHeader title="ขอแก้ไขข่าว" priority={1}>{children}</ResidentRouteHeader>; }

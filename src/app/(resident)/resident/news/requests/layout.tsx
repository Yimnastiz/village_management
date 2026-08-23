import { ResidentRouteHeader } from "@/components/resident/resident-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <ResidentRouteHeader title="คำขอข่าว" description="ติดตามสถานะคำขอเพิ่มหรือแก้ไขข่าว">{children}</ResidentRouteHeader>; }

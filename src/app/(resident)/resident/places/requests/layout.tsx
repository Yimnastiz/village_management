import { ResidentRouteHeader } from "@/components/resident/resident-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <ResidentRouteHeader title="คำขอสถานที่" description="ติดตามสถานะคำขอเพิ่มหรือแก้ไขสถานที่">{children}</ResidentRouteHeader>; }

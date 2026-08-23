import { ResidentRouteHeader } from "@/components/resident/resident-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <ResidentRouteHeader title="แดชบอร์ด" description="ภาพรวมข่าวสาร กิจกรรม นัดหมาย และข้อมูลสำคัญของคุณ">{children}</ResidentRouteHeader>; }

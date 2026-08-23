import { ResidentRouteHeader } from "@/components/resident/resident-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <ResidentRouteHeader title="ข้อมูลครัวเรือน" description="ตรวจสอบข้อมูลบ้านและสมาชิกในครัวเรือน">{children}</ResidentRouteHeader>; }

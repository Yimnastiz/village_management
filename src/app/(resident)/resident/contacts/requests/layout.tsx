import { ResidentRouteHeader } from "@/components/resident/resident-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <ResidentRouteHeader title="คำขอผู้ติดต่อ" description="ติดตามผลการพิจารณาคำขอที่คุณส่ง" priority={2}>{children}</ResidentRouteHeader>; }

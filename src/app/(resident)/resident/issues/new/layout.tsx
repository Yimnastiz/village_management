import { ResidentRouteHeader } from "@/components/resident/resident-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <ResidentRouteHeader title="แจ้งปัญหา" description="ระบุรายละเอียดปัญหาเพื่อส่งให้ผู้ดูแลหมู่บ้านตรวจสอบและดำเนินการ" priority={2}>{children}</ResidentRouteHeader>; }

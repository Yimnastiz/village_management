import { ResidentRouteHeader } from "@/components/resident/resident-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <ResidentRouteHeader title="ขอเพิ่มข่าว" description="ข่าวที่ส่งจะเข้าสู่คิวตรวจสอบและเผยแพร่หลังผู้ดูแลหมู่บ้านอนุมัติ" priority={1}>{children}</ResidentRouteHeader>; }

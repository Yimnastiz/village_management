import { ResidentRouteHeader } from "@/components/resident/resident-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <ResidentRouteHeader title="ขอเพิ่มสถานที่" description="คำขอจะถูกส่งให้ผู้ดูแลหมู่บ้านตรวจสอบก่อนเผยแพร่" priority={1}>{children}</ResidentRouteHeader>; }

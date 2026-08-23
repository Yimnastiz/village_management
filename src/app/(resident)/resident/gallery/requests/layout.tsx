import { ResidentRouteHeader } from "@/components/resident/resident-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <ResidentRouteHeader title="คำขอเพิ่มรูป" description="ติดตามสถานะรูปภาพที่คุณส่งให้ผู้ดูแลพิจารณา" priority={2}>{children}</ResidentRouteHeader>; }

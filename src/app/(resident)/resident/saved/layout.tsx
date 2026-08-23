import { ResidentRouteHeader } from "@/components/resident/resident-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <ResidentRouteHeader title="รายการที่บันทึก" description="รวมรายการสำคัญที่คุณบันทึกไว้เพื่อกลับมาดูภายหลัง" priority={1}>{children}</ResidentRouteHeader>; }

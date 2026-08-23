import { ResidentRouteHeader } from "@/components/resident/resident-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <ResidentRouteHeader title="ข้อมูลติดต่อ" description="ค้นหาข้อมูลติดต่อที่สำคัญภายในหมู่บ้าน" priority={1}>{children}</ResidentRouteHeader>; }

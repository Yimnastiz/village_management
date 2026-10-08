import { ResidentRouteHeader } from "@/components/resident/resident-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <ResidentRouteHeader title="ข้อมูลงบประมาณ" description="ดูข้อมูลและเอกสารด้านงบประมาณของหมู่บ้าน" priority={1}>{children}</ResidentRouteHeader>; }

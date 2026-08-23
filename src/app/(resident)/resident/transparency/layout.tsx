import { ResidentRouteHeader } from "@/components/resident/resident-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <ResidentRouteHeader title="ข้อมูลความโปร่งใส" description="ดูข้อมูลและเอกสารด้านความโปร่งใสของหมู่บ้าน" priority={1}>{children}</ResidentRouteHeader>; }

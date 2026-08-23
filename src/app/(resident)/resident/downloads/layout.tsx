import { ResidentRouteHeader } from "@/components/resident/resident-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <ResidentRouteHeader title="ดาวน์โหลด" description="ค้นหาและดาวน์โหลดเอกสารของหมู่บ้าน" priority={1}>{children}</ResidentRouteHeader>; }

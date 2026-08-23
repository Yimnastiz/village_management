import { ResidentRouteHeader } from "@/components/resident/resident-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <ResidentRouteHeader title="แกลเลอรี" description="ดูภาพกิจกรรมและอัลบั้มของหมู่บ้าน" priority={1}>{children}</ResidentRouteHeader>; }

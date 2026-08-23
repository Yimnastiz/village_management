import { ResidentRouteHeader } from "@/components/resident/resident-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <ResidentRouteHeader title="แจ้งปัญหา" description="แจ้งและติดตามปัญหาภายในหมู่บ้าน" priority={1}>{children}</ResidentRouteHeader>; }

import { ResidentRouteHeader } from "@/components/resident/resident-route-header";
export default function Layout({ children }: { children: React.ReactNode }) { return <ResidentRouteHeader title="ข้อมูลส่วนตัว" description="ตรวจสอบข้อมูลบัญชีและข้อมูลทะเบียนของคุณ">{children}</ResidentRouteHeader>; }

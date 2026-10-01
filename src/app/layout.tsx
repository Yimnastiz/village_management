import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = { title: "ระบบบริหารจัดการข้อมูลพื้นฐานของหมู่บ้าน", description: "ระบบสำหรับเผยแพร่ข้อมูล ข่าวสาร บริการ และบริหารจัดการข้อมูลพื้นฐานของหมู่บ้าน", icons: { icon: [{ url: "/brand/logo.svg", type: "image/svg+xml" }] } };
export const dynamic = "force-dynamic";
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="th"><body className="antialiased bg-gray-50 text-gray-900"><ToastProvider>{children}</ToastProvider></body></html>; }

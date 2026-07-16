import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ระบบบริหารจัดการหมู่บ้านอัจฉริยะ",
  description: "Smart Village Management System - ระบบบริหารจัดการหมู่บ้านสำหรับชุมชนไทย",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body
        className="antialiased bg-gray-50 text-gray-900"
      >
        {children}
      </body>
    </html>
  );
}

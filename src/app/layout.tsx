import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "ระบบบริหารจัดการหมู่บ้านอัจฉริยะ",
  description: "Smart Village Management System - ระบบบริหารจัดการหมู่บ้านสำหรับชุมชนไทย",
  icons: {
    icon: [{ url: "/brand/logo.svg", type: "image/svg+xml" }],
  },
};

// Village configuration and system settings are database-backed runtime state.
// Rendering dynamically prevents static generation from querying the database
// during a deployment build.
export const dynamic = "force-dynamic";

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
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

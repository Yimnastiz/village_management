"use client";
import { LogOut } from "lucide-react";
import { useState } from "react";

export function SuperAdminLogoutButton({ collapsed = false }: { collapsed?: boolean }) {
  const [loading, setLoading] = useState(false);
  const label = loading ? "กำลังออก..." : "ออกจากระบบ";
  return <button type="button" disabled={loading} onClick={async () => { setLoading(true); await fetch("/api/superadmin/logout", { method: "POST", credentials: "same-origin" }); window.location.assign("/superadmin/access"); }} aria-label={label} title={collapsed ? "ออกจากระบบ" : undefined} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-red-300 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50 ${collapsed ? "justify-center px-0" : "w-full"}`}><LogOut className="h-4 w-4" /><span className={collapsed ? "sr-only" : ""}>{label}</span></button>;
}

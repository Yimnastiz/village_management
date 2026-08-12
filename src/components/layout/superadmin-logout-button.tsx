"use client";
import { LogOut } from "lucide-react";
import { useState } from "react";

export function SuperAdminLogoutButton() {
  const [loading, setLoading] = useState(false);
  return <button type="button" disabled={loading} onClick={async () => { setLoading(true); await fetch("/api/superadmin/logout", { method: "POST", credentials: "same-origin" }); window.location.assign("/superadmin/access"); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"><LogOut className="h-4 w-4" />{loading ? "กำลังออก..." : "ออกจากระบบ"}</button>;
}

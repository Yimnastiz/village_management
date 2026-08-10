"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { clearLoginOtpState, signOut } from "@/lib/auth-client";

type LogoutButtonProps = {
  mode?: "icon" | "menu";
};

export function LogoutButton({ mode = "icon" }: LogoutButtonProps) {
  const router = useRouter();

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await signOut();
    } finally {
      // Retry the Better Auth endpoint directly if the client helper is
      // interrupted, so the server session and cookie are cleared reliably.
      await fetch("/api/auth/sign-out", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => undefined);
      clearLoginOtpState();
      router.replace("/auth/login");
      router.refresh();
    }
  };

  if (mode === "menu") {
    return (
      <button
        onClick={handleLogout}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
        aria-label="ออกจากระบบ"
        type="button"
        suppressHydrationWarning
      >
        <LogOut className="h-4 w-4" />
        ออกจากระบบ
      </button>
    );
  }

  return (
    <button
      onClick={handleLogout}
      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
      aria-label="ออกจากระบบ"
      type="button"
      suppressHydrationWarning
    >
      <LogOut className="h-5 w-5" />
    </button>
  );
}

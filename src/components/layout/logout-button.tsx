"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { clearLoginOtpState, SignOutError, signOutCurrentSession } from "@/lib/auth-client";

type LogoutButtonProps = {
  mode?: "icon" | "menu";
};

export function LogoutButton({ mode = "icon" }: LogoutButtonProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { error: showError } = useToast();

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isSigningOut) return;

    setIsSigningOut(true);
    try {
      await signOutCurrentSession();

      clearLoginOtpState();
      // Navigation begins only after Better Auth has invalidated the session
      // and the browser has applied its Set-Cookie headers.
      window.location.replace("/auth/login");
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[logout] sign-out failed", {
          errorName: error instanceof Error ? error.name : "UnknownError",
          message: error instanceof Error ? error.message : String(error),
          ...(error instanceof SignOutError ? error.details : {}),
        });
      }
      showError("ไม่สามารถออกจากระบบได้", "กรุณาลองอีกครั้ง");
      setIsSigningOut(false);
    }
  };

  if (mode === "menu") {
    return (
      <button
        onClick={handleLogout}
        disabled={isSigningOut}
        className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
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
      disabled={isSigningOut}
      className="p-2 text-gray-400 transition-colors hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-60"
      aria-label="ออกจากระบบ"
      type="button"
      suppressHydrationWarning
    >
      <LogOut className="h-5 w-5" />
    </button>
  );
}

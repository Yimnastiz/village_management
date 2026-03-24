"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

type LogoutButtonProps = {
  mode?: "icon" | "menu";
};

export function LogoutButton({ mode = "icon" }: LogoutButtonProps) {
  const router = useRouter();

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      // Call sign-out to clear session on backend
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            // Redirect to login after successful logout
            router.push("/auth/login");
            router.refresh();
          },
          onError: () => {
            // Even if server-side logout fails, redirect to login
            router.push("/auth/login");
            router.refresh();
          },
        },
      });
    } catch (error) {
      console.error("Logout error:", error);
      // Fallback: redirect to login if something goes wrong
      router.push("/auth/login");
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

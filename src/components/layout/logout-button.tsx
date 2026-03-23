"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function LogoutButton() {
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

  return (
    <button
      onClick={handleLogout}
      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
      aria-label="ออกจากระบบ"
      type="button"
    >
      <LogOut className="h-5 w-5" />
    </button>
  );
}

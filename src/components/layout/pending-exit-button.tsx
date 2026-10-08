"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

export function PendingExitButton() {
  const [isExiting, setIsExiting] = useState(false);
  const exit = async () => {
    if (isExiting) return;
    setIsExiting(true);
    try {
      await fetch("/api/auth/pending-resident/exit", { method: "POST", credentials: "include" });
    } finally {
      window.location.replace("/auth/login");
    }
  };
  return <button type="button" onClick={() => void exit()} disabled={isExiting} className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"><LogOut className="h-4 w-4" />ออกจากระบบ</button>;
}

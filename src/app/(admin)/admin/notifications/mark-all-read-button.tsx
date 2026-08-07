"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { markAllNotificationsAsReadAction } from "./actions";
import { useToast } from "@/components/ui/toast";

export function MarkAllReadButton() {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleMarkAllRead = async () => {
    setIsLoading(true);
    try {
      await markAllNotificationsAsReadAction();
      success("ทำเครื่องหมายว่าอ่านแล้ว");
      router.refresh();
    } catch (error) {
      console.error("Error marking all as read:", error);
      showError("ดำเนินการไม่สำเร็จ", "กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleMarkAllRead}
      disabled={isLoading}
      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Check className="w-4 h-4" />
      {isLoading ? "กำลังอัปเดต..." : "ทำเครื่องหมายว่าอ่านแล้วทั้งหมด"}
    </button>
  );
}

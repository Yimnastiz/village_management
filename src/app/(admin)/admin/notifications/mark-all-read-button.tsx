"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { markAllNotificationsAsReadAction } from "./actions";

export function MarkAllReadButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleMarkAllRead = async () => {
    setIsLoading(true);
    try {
      await markAllNotificationsAsReadAction();
    } catch (error) {
      console.error("Error marking all as read:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleMarkAllRead}
      disabled={isLoading}
      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
    >
      <Check className="w-4 h-4" />
      {isLoading ? "กำลังอัปเดต..." : "ทำเครื่องหมายว่าอ่านแล้วทั้งหมด"}
    </button>
  );
}

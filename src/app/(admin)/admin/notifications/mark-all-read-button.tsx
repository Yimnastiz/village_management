"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { markAllNotificationsAsReadAction } from "./actions";
import { useToast } from "@/components/ui/toast";

export function MarkAllReadButton() {
  const router = useRouter();
  const { success, error } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const handleMarkAllRead = async () => { setIsLoading(true); try { await markAllNotificationsAsReadAction(); success("ทำเครื่องหมายว่าอ่านแล้วทั้งหมด"); router.refresh(); } catch { error("ไม่สามารถดำเนินการได้", "กรุณาลองใหม่อีกครั้ง"); } finally { setIsLoading(false); } };
  return <button type="button" onClick={handleMarkAllRead} disabled={isLoading} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50"><Check className="size-4" />{isLoading ? "กำลังดำเนินการ..." : "ทำเครื่องหมายว่าอ่านแล้วทั้งหมด"}</button>;
}

"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Notification, NotificationStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";

type Props = {
  notification: Notification;
  title: string;
  body?: string | null;
  destination: string | null;
  markAsRead: (id: string) => Promise<unknown>;
};

export function NotificationCard({ notification, title, body, destination, markAsRead }: Props) {
  const router = useRouter();
  const { error } = useToast();
  const [isRead, setIsRead] = useState(notification.status !== NotificationStatus.UNREAD);
  const [isUpdating, setIsUpdating] = useState(false);
  const canAct = !isRead || Boolean(destination);

  const handleClick = async () => {
    if (!canAct || isUpdating) return;
    const wasUnread = !isRead;
    if (wasUnread) {
      setIsRead(true);
      setIsUpdating(true);
      try {
        await markAsRead(notification.id);
      } catch {
        setIsRead(false);
        error("ไม่สามารถอัปเดตสถานะการแจ้งเตือนได้", "กรุณาลองใหม่อีกครั้ง");
        return;
      } finally {
        setIsUpdating(false);
      }
    }
    if (destination) router.push(destination.includes("from=notifications") ? destination : `${destination}${destination.includes("?") ? "&" : "?"}from=notifications`);
    else if (wasUnread) router.refresh();
  };

  return (
    <article className={`overflow-hidden rounded-xl border transition-colors ${isRead ? "border-gray-200 bg-gray-50" : "border-blue-200 bg-blue-50"}`}>
      <button type="button" onClick={handleClick} disabled={isUpdating}
        aria-label={destination ? `เปิดการแจ้งเตือน: ${title}` : `ทำเครื่องหมายการแจ้งเตือนว่าอ่านแล้ว: ${title}`}
        className={`flex min-h-24 w-full gap-3 p-4 text-left sm:p-5 ${canAct ? "cursor-pointer hover:bg-slate-900/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600" : "cursor-default"}`}>
        <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${isRead ? "bg-gray-300" : "bg-blue-500"}`} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className={`block break-words text-sm font-semibold sm:text-base ${isRead ? "text-gray-600" : "text-gray-900"}`}>{title}</span>
          {body ? <span className={`mt-1 block break-words text-sm leading-6 ${isRead ? "text-gray-500" : "text-gray-700"}`}>{body}</span> : null}
          <time className={`mt-3 block text-xs ${isRead ? "text-gray-400" : "text-gray-500"}`} dateTime={notification.createdAt.toISOString()}>{notification.createdAt.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
        </span>
        {destination ? <ChevronRight className="mt-0.5 size-5 shrink-0 text-gray-400" aria-hidden="true" /> : null}
      </button>
    </article>
  );
}

"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Notification, NotificationStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { formatNotificationTimestamp, resolveNotificationPresentation } from "@/lib/notification-presentation";

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
  const presentation = resolveNotificationPresentation(notification);
  const ModuleIcon = presentation.icon;

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
        // Reading is advisory for navigation. A transient update failure should
        // not prevent access to a destination that was already authorized.
        if (destination) router.push(destination.includes("from=notifications") ? destination : `${destination}${destination.includes("?") ? "&" : "?"}from=notifications`);
        return;
      } finally {
        setIsUpdating(false);
      }
    }
    if (destination) router.push(destination.includes("from=notifications") ? destination : `${destination}${destination.includes("?") ? "&" : "?"}from=notifications`);
    else if (wasUnread) router.refresh();
  };

  return (
    <article className={`overflow-hidden rounded-xl border transition-colors ${isRead ? "border-gray-200 bg-white" : "border-blue-200 bg-blue-50/70"}`}>
      <button type="button" onClick={handleClick} disabled={isUpdating}
        aria-label={destination ? `เปิดการแจ้งเตือน: ${title}` : `ทำเครื่องหมายการแจ้งเตือนว่าอ่านแล้ว: ${title}`}
        className={`flex min-h-24 w-full gap-3 p-4 text-left sm:gap-4 sm:p-5 ${canAct ? "cursor-pointer hover:bg-slate-900/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600" : "cursor-default"}`}>
        <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${presentation.iconContainerClassName}`} aria-hidden="true"><ModuleIcon className={`size-4 ${presentation.iconClassName}`} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2"><span className="min-w-0 flex-1 break-words text-sm font-semibold text-gray-900 sm:text-base">{title}</span>{!isRead ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-600" aria-label="ยังไม่ได้อ่าน" /> : null}</span>
          {body ? <span className="mt-1 block break-words text-sm leading-6 text-gray-600">{body}</span> : null}
          <span className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500"><time dateTime={notification.createdAt.toISOString()}>{formatNotificationTimestamp(notification.createdAt)}</time>{destination ? <ChevronRight className="size-4 shrink-0 text-gray-400" aria-hidden="true" /> : null}</span>
        </span>
      </button>
    </article>
  );
}

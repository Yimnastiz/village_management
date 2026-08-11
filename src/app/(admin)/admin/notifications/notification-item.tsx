"use client";

import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Notification, NotificationStatus } from "@prisma/client";
import { getAdminNotificationCopy, resolveAdminNotificationDestination } from "@/lib/admin-notification";
import { useToast } from "@/components/ui/toast";
import { markNotificationAsReadAction } from "./actions";

interface NotificationItemProps {
  notification: Notification;
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const router = useRouter();
  const { error } = useToast();
  const [isRead, setIsRead] = useState(notification.status !== NotificationStatus.UNREAD);
  const [isUpdating, setIsUpdating] = useState(false);
  const href = resolveAdminNotificationDestination(notification);
  const copy = getAdminNotificationCopy(notification);

  const markRead = () => {
    if (isRead || isUpdating) return;
    setIsRead(true);
    setIsUpdating(true);
    void markNotificationAsReadAction(notification.id)
      .then(() => router.refresh())
      .catch(() => {
        setIsRead(false);
        error("ไม่สามารถทำเครื่องหมายว่าอ่านแล้วได้", "กรุณาลองใหม่อีกครั้ง");
      })
      .finally(() => setIsUpdating(false));
  };

  const openNotification = () => {
    markRead();
    if (href) router.push(href);
  };

  return (
    <article className={`relative overflow-hidden rounded-xl border p-4 transition-colors sm:p-5 ${
      isRead ? "border-gray-200 bg-white" : "border-blue-100 bg-blue-50/70"
    }`}>
      <button
        type="button"
        onClick={openNotification}
        aria-label={href ? `เปิดรายละเอียด: ${copy.title}` : `ทำเครื่องหมายว่าอ่านแล้ว: ${copy.title}`}
        className={`absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${
          href ? "cursor-pointer hover:bg-slate-900/[0.02]" : "cursor-default"
        }`}
      />

      <div className="pointer-events-none relative z-10 flex min-w-0 gap-3">
        <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${isRead ? "bg-gray-300" : "bg-blue-500"}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className={`break-words text-sm font-semibold sm:text-base ${isRead ? "text-gray-700" : "text-gray-900"}`}>{copy.title}</h2>
          {copy.body ? <p className="mt-1 break-words text-sm leading-6 text-gray-600">{copy.body}</p> : null}
          <time className="mt-3 block text-xs text-gray-500" dateTime={new Date(notification.createdAt).toISOString()}>
            {new Date(notification.createdAt).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </time>
        </div>
        {href ? <ChevronRight className="mt-0.5 size-5 shrink-0 text-gray-400" aria-hidden="true" /> : null}
      </div>

      <div className="relative z-10 mt-3 flex items-center justify-end gap-2">
        {!isRead ? (
          <button type="button" onClick={markRead} disabled={isUpdating} className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50">
            <Check className="size-4" /> ทำเครื่องหมายว่าอ่านแล้ว
          </button>
        ) : null}
        {href ? (
          <button type="button" onClick={openNotification} className="inline-flex min-h-10 items-center gap-1 rounded-md px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            ดูรายละเอียด <ChevronRight className="size-4" />
          </button>
        ) : null}
      </div>
    </article>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Notification, NotificationStatus } from "@prisma/client";
import { markNotificationAsReadAction } from "./actions";

interface NotificationItemProps {
  notification: Notification;
  onMarkRead?: () => void;
}

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const isUnread = notification.status === NotificationStatus.UNREAD;

  const getMetadata = () => {
    try {
      return notification.metadata as Record<string, unknown> | null;
    } catch {
      return null;
    }
  };

  const metadata = getMetadata();
  const actionUrl = metadata?.actionUrl ? (metadata.actionUrl as string) : null;
  const actionLabel = metadata?.actionLabel ? (metadata.actionLabel as string) : "ไปยังหน้าต่อไป";

  const handleClick = async () => {
    if (!isUnread || isUpdating) return;

    setIsUpdating(true);
    try {
      await markNotificationAsReadAction(notification.id);
      onMarkRead?.();
    } catch (error) {
      console.error("Error marking notification as read:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`rounded-xl border transition-all ${
        isUnread
          ? "bg-blue-50 border-blue-200 cursor-pointer hover:bg-blue-100 hover:border-blue-300"
          : "bg-gray-50 border-gray-200 text-gray-600"
      } p-4`}
    >
      <div className="flex gap-3">
        {/* Dot indicator */}
        <div
          className={`w-2.5 h-2.5 mt-1.5 rounded-full flex-shrink-0 ${
            isUnread ? "bg-blue-500" : "bg-gray-300"
          }`}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={`font-semibold transition-colors ${
              isUnread ? "text-gray-900" : "text-gray-600"
            }`}
          >
            {notification.title}
          </p>

          {notification.body && (
            <p className={`text-sm mt-1 ${isUnread ? "text-gray-700" : "text-gray-500"}`}>
              {notification.body}
            </p>
          )}

          {/* Metadata and Action */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className={`text-xs ${isUnread ? "text-gray-500" : "text-gray-400"}`}>
              {new Date(notification.createdAt).toLocaleDateString("th-TH", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>

            {actionUrl && (
              <Link
                href={actionUrl}
                onClick={(e) => e.stopPropagation()}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                {actionLabel} →
              </Link>
            )}
          </div>
        </div>

        {/* Unread indicator - right side dot for visual balance */}
        {isUnread && (
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
        )}
      </div>
    </div>
  );
}

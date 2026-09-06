import type { Notification } from "@prisma/client";
import { formatNotificationTimestamp, resolveNotificationPresentation } from "@/lib/notification-presentation";

export function NotificationDetailHeader({ notification, title }: { notification: Notification; title: string }) {
  const presentation = resolveNotificationPresentation(notification);
  const DetailIcon = presentation.icon;

  return (
    <header className="flex items-start gap-3">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${presentation.iconContainerClassName}`} aria-hidden="true">
        <DetailIcon className={`size-5 ${presentation.iconClassName}`} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="min-w-0 break-words text-xl font-bold text-gray-900">{title}</h1>
          {presentation.badge ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${presentation.badgeClassName ?? ""}`}>{presentation.badge}</span> : null}
        </div>
        {presentation.sourceAttribution ? <p className="mt-2 text-sm text-gray-600">{presentation.sourceAttribution}</p> : null}
        <p className="mt-2 text-xs text-gray-500">{formatNotificationTimestamp(notification.createdAt)}</p>
      </div>
    </header>
  );
}

export function notificationDetailAccent(notification: Notification) {
  return resolveNotificationPresentation(notification).accentClassName ?? "";
}

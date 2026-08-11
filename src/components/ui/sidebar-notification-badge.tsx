import { cn } from "@/lib/utils";

type SidebarNotificationBadgeProps = {
  count: number;
  label: string;
  className?: string;
};

export function SidebarNotificationBadge({ count, label, className }: SidebarNotificationBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > 99 ? "99+" : count;
  return (
    <span
      role="status"
      aria-label={`มี${label}รอดำเนินการ ${count} รายการ`}
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white",
        className,
      )}
    >
      <span aria-hidden="true">{displayCount}</span>
    </span>
  );
}

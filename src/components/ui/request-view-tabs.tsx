import Link from "next/link";
import { cn } from "@/lib/utils";

type RequestViewTab = { href: string; label: string; active: boolean; count?: number };

/** Shared pending/history navigation used by admin request queues. */
export function RequestViewTabs({ tabs, label, className }: { tabs: RequestViewTab[]; label: string; className?: string }) {
  return <nav className={cn("flex w-full flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1 sm:w-fit", className)} aria-label={label}>
    {tabs.map((tab) => <Link key={tab.href} href={tab.href} aria-current={tab.active ? "page" : undefined} className={cn("inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-center text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1 sm:flex-none", tab.active ? "bg-green-700 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")}>
      <span>{tab.label}</span>
      {tab.count && tab.count > 0 ? <span className={cn("inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold", tab.active ? "bg-white/20 text-white" : "bg-red-100 text-red-700")}>{tab.count > 99 ? "99+" : tab.count}</span> : null}
    </Link>)}
  </nav>;
}

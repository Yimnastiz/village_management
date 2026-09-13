export function AdminPendingCountBadge({ count }: { count: number }) {
  return <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white">{count}</span>;
}

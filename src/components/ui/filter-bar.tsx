import { cn } from "@/lib/utils";

type FilterBarProps = {
  children: React.ReactNode;
  className?: string;
};

/** Consistent surface for search, filters, sort controls, and clear actions. */
export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <section aria-label="ตัวกรองรายการ" className={cn("rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4", className)}>
      {children}
    </section>
  );
}

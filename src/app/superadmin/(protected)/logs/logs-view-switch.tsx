"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function LogsViewSwitch({ view }: { view: "all" | "important" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const checked = view === "important";

  function handleChange() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", checked ? "all" : "important");
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="ml-auto flex min-h-9 flex-wrap items-center justify-end gap-2 text-sm text-slate-700">
      <span>กิจกรรมทั้งหมด</span>
      <label className="relative inline-flex min-h-9 min-w-11 cursor-pointer items-center" title="แสดงเฉพาะบันทึกสำคัญ">
        <span className="sr-only">แสดงเฉพาะบันทึกสำคัญ</span>
        <input type="checkbox" checked={checked} onChange={handleChange} className="peer sr-only" />
        <span aria-hidden="true" className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-slate-700 peer-focus-visible:ring-2 peer-focus-visible:ring-green-500 peer-focus-visible:ring-offset-2 after:absolute after:left-0.5 after:top-1/2 after:h-5 after:w-5 after:-translate-y-1/2 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" />
      </label>
      <span className={checked ? "font-medium text-slate-900" : ""}>บันทึกสำคัญ</span>
    </div>
  );
}

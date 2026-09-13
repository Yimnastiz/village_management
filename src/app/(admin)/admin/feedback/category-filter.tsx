"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { categoryOptions } from "./feedback-presentation";

export function FeedbackCategoryFilter({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function changeCategory(category: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (category === "all") params.delete("category");
    else params.set("category", category);
    params.delete("page");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <label className="flex min-h-9 items-center gap-2 rounded-lg bg-gray-50 px-3 text-sm text-gray-600">
      <span className="shrink-0">ประเภท</span>
      <select aria-label="ประเภทความคิดเห็น" value={value} onChange={(event) => changeCategory(event.target.value)} className="min-w-0 cursor-pointer bg-transparent font-medium text-gray-800 outline-none focus-visible:ring-2 focus-visible:ring-green-600">
        {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

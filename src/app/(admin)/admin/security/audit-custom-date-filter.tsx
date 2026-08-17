"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function AuditCustomDateFilter({ from, to }: { from: string; to: string }) {
  const [start, setStart] = useState(from); const [end, setEnd] = useState(to); const router = useRouter(); const pathname = usePathname(); const searchParams = useSearchParams();
  if (!searchParams.get("period") || searchParams.get("period") !== "CUSTOM") return null;
  return <form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); const params = new URLSearchParams(searchParams.toString()); if (start) params.set("from", start); else params.delete("from"); if (end) params.set("to", end); else params.delete("to"); params.delete("page"); router.replace(`${pathname}?${params.toString()}`, { scroll: false }); }}><label className="text-xs font-semibold text-gray-500" htmlFor="audit-from">ตั้งแต่</label><input id="audit-from" type="date" value={start} onChange={(event) => setStart(event.target.value)} className="h-8 rounded-md border border-gray-300 px-2 text-xs" /><label className="text-xs font-semibold text-gray-500" htmlFor="audit-to">ถึง</label><input id="audit-to" type="date" min={start || undefined} value={end} onChange={(event) => setEnd(event.target.value)} className="h-8 rounded-md border border-gray-300 px-2 text-xs" /><button type="submit" className="h-8 rounded-md bg-green-700 px-2.5 text-xs font-medium text-white hover:bg-green-800">ใช้ช่วงเวลา</button></form>;
}

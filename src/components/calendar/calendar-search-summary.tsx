"use client";

export type CalendarSearchResult = {
  id: string;
  type: "event" | "appointment";
  title: string;
  date: string;
  selectionDate?: string;
};

function shortThaiDate(date: string) {
  return new Date(`${date}T00:00:00+07:00`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Bangkok",
  });
}

export function CalendarSearchSummary({
  query,
  monthLabel,
  results,
  emptyMessage,
  onSelectDate,
}: {
  query: string;
  monthLabel: string;
  results: CalendarSearchResult[];
  emptyMessage: string;
  onSelectDate: (date: string) => void;
}) {
  if (!query.trim()) return null;
  const visibleResults = results.slice(0, 5);

  return <section aria-live="polite" className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
    {results.length ? <>
      <p><span className="font-medium text-gray-900">ผลการค้นหา “{query}”</span> · พบ {results.length.toLocaleString("th-TH")} รายการในเดือน{monthLabel}</p>
      <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {visibleResults.map((result) => <li key={`${result.type}-${result.id}`}>
          <button type="button" onClick={() => onSelectDate(result.selectionDate ?? result.date)} className="inline-flex items-baseline gap-2 text-left text-emerald-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500">
            <span className="shrink-0 text-xs text-gray-500">{shortThaiDate(result.date)}</span>
            <span>{result.title}</span>
          </button>
        </li>)}
      </ul>
      {results.length > visibleResults.length ? <p className="mt-1 text-xs text-gray-500">และอีก {(results.length - visibleResults.length).toLocaleString("th-TH")} รายการ</p> : null}
    </> : <p>{emptyMessage}</p>}
  </section>;
}

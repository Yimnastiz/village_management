import Link from "next/link";

function buildHref(pathname: string, page: number, params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value.length > 0) {
      searchParams.set(key, value);
    }
  });
  searchParams.set("page", String(page));
  return `${pathname}?${searchParams.toString()}`;
}

export function QueryPagination({
  pathname,
  page,
  totalPages,
  params,
}: {
  pathname: string;
  page: number;
  totalPages: number;
  params: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      <Link
        href={buildHref(pathname, Math.max(1, page - 1), params)}
        aria-disabled={page <= 1}
        className={`rounded-lg border px-3 py-2 text-sm ${page <= 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
      >
        ก่อนหน้า
      </Link>
      <span className="text-sm text-slate-600">หน้า {page} / {totalPages}</span>
      <Link
        href={buildHref(pathname, Math.min(totalPages, page + 1), params)}
        aria-disabled={page >= totalPages}
        className={`rounded-lg border px-3 py-2 text-sm ${page >= totalPages ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
      >
        ถัดไป
      </Link>
    </div>
  );
}

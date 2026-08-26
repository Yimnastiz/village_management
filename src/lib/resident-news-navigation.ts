/** Safe, scoped return context for Resident News pages. */
export type ResidentNewsFrom = "requests-pending" | "requests-history" | "requests-published" | "news-list";

export type ResidentNewsContext = {
  from: ResidentNewsFrom;
  q?: string;
  sort?: "newest" | "oldest";
  source?: "all" | "admin" | "resident";
  visibility?: string;
};

type Search = Record<string, string | undefined>;

const fromValues: readonly ResidentNewsFrom[] = ["requests-pending", "requests-history", "requests-published", "news-list"];
const visibilityValues = new Set(["PUBLIC", "RESIDENT_ONLY"]);

function safeText(value: string | undefined) {
  const text = value?.trim();
  return text && text.length <= 120 ? text : undefined;
}

export function readResidentNewsContext(query: Search): ResidentNewsContext | null {
  if (!fromValues.includes(query.from as ResidentNewsFrom)) return null;
  const from = query.from as ResidentNewsFrom;
  const context: ResidentNewsContext = { from };
  const q = safeText(query.q);
  if (q) context.q = q;

  if (from === "news-list") {
    if (query.sort === "oldest" || query.sort === "newest") context.sort = query.sort;
    if (query.source === "all" || query.source === "admin" || query.source === "resident") context.source = query.source;
    const visibility = query.visibility?.split(",").filter((value) => visibilityValues.has(value)).sort().join(",");
    if (visibility) context.visibility = visibility;
  }
  return context;
}

export function residentNewsContextQuery(context: ResidentNewsContext) {
  const params = new URLSearchParams({ from: context.from });
  if (context.q) params.set("q", context.q);
  if (context.from === "news-list") {
    if (context.sort && context.sort !== "newest") params.set("sort", context.sort);
    if (context.source && context.source !== "all") params.set("source", context.source);
    if (context.visibility) params.set("visibility", context.visibility);
  }
  return params.toString();
}

function withContext(path: string, context: ResidentNewsContext | null) {
  return context ? `${path}?${residentNewsContextQuery(context)}` : path;
}

export function requestListHref(context: ResidentNewsContext | null) {
  if (context?.from === "requests-history") return "/resident/news/requests?tab=history";
  if (context?.from === "requests-published") {
    const params = new URLSearchParams({ tab: "published" });
    if (context.q) params.set("q", context.q);
    return `/resident/news/requests?${params}`;
  }
  return "/resident/news/requests";
}

export function newsListHref(context: ResidentNewsContext | null) {
  if (context?.from !== "news-list") return "/resident/news";
  const params = new URLSearchParams();
  if (context.q) params.set("q", context.q);
  if (context.sort === "oldest") params.set("sort", context.sort);
  if (context.source && context.source !== "all") params.set("source", context.source);
  if (context.visibility) params.set("visibility", context.visibility);
  return params.size ? `/resident/news?${params}` : "/resident/news";
}

export function requestDetailHref(id: string, context: ResidentNewsContext | null) { return withContext(`/resident/news/requests/${id}`, context); }
export function requestEditHref(id: string, context: ResidentNewsContext | null) { return withContext(`/resident/news/requests/${id}/edit`, context); }
export function newsDetailHref(id: string, context: ResidentNewsContext | null) { return withContext(`/resident/news/${id}`, context); }
export function newsRequestEditHref(id: string, context: ResidentNewsContext | null) { return withContext(`/resident/news/${id}/request-edit`, context); }
export function newRequestHref(context: ResidentNewsContext | null, newsId?: string) {
  const params = new URLSearchParams();
  if (newsId) params.set("newsId", newsId);
  if (context) new URLSearchParams(residentNewsContextQuery(context)).forEach((value, key) => params.set(key, value));
  return params.size ? `/resident/news/requests/new?${params}` : "/resident/news/requests/new";
}

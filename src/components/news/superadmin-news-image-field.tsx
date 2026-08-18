"use client";

import { useState } from "react";
import { NewsImageManager } from "./news-image-manager";

export function SuperAdminNewsImageField({ initialUrls, initialCoverUrl }: { initialUrls: string[]; initialCoverUrl?: string | null }) {
  const [urls, setUrls] = useState(initialUrls);
  const [coverUrl, setCoverUrl] = useState<string | null>(initialCoverUrl && initialUrls.includes(initialCoverUrl) ? initialCoverUrl : initialUrls[0] ?? null);
  return <>
    <input type="hidden" name="imageUrls" value={urls.join("\n")} />
    <input type="hidden" name="coverUrl" value={coverUrl ?? ""} />
    <NewsImageManager value={urls.map((url, sortOrder) => ({ url, sortOrder, isCover: coverUrl ? url === coverUrl : sortOrder === 0 }))} onChange={(items) => { const next = items.map((item) => item.url); setUrls(next); setCoverUrl(items.find((item) => item.isCover)?.url ?? next[0] ?? null); }} />
    <details className="text-sm text-slate-600"><summary className="cursor-pointer font-medium">เพิ่มรูปด้วย URL (ขั้นสูง)</summary><textarea className="mt-2 min-h-20 w-full rounded-lg border border-slate-300 p-2" value={urls.filter((url) => /^https?:/.test(url)).join("\n")} onChange={(event) => { const manual = event.target.value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean); setUrls([...urls.filter((url) => !/^https?:/.test(url)), ...manual]); }} /></details>
  </>;
}

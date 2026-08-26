import Link from "next/link";
import { Newspaper, Pin } from "lucide-react";

type NewsCardProps = { href: string; title: string; summary?: string | null; imageUrl?: string | null; isPinned?: boolean; showPinnedIndicator?: boolean; metadata?: React.ReactNode; badge?: React.ReactNode; meta: string };

export function NewsCard({ href, title, summary, imageUrl, isPinned, showPinnedIndicator = true, metadata, badge, meta }: NewsCardProps) {
  return <Link href={href} className="group block overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
    <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-green-50 via-emerald-50 to-teal-100">
      {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" /> : <Newspaper className="absolute left-5 top-5 h-8 w-8 text-green-700/70" />}
      {showPinnedIndicator && isPinned ? <span title="ข่าวปักหมุด" aria-label="ข่าวปักหมุด" className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-amber-600 shadow-sm"><Pin className="h-4 w-4" /></span> : null}
    </div>
    <div className="p-4"><h2 className="line-clamp-2 font-semibold leading-6 text-gray-900 group-hover:text-green-700">{title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-500">{summary?.trim() || "อ่านรายละเอียดและความคืบหน้าจากหมู่บ้าน"}</p>{metadata || badge ? <div className="mt-3">{metadata ?? badge}</div> : null}<p className="mt-2 text-xs text-gray-400">{meta}</p></div>
  </Link>;
}

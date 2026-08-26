"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { NewsDeleteRequestButton } from "../requests/news-delete-request-button";

type Props = { newsId: string; editHref: string; pendingRequestHref?: string | null };

/** Owner-only moderated actions for a published Resident News item. */
export function ResidentNewsOwnerActions({ newsId, editHref, pendingRequestHref }: Props) {
  if (pendingRequestHref !== undefined) {
    return <div className="flex flex-wrap items-center justify-end gap-2 text-sm" aria-label="สถานะคำขอข่าว">
      <span className="text-amber-700">มีคำขอรอพิจารณา</span>
      {pendingRequestHref ? <Link href={pendingRequestHref} className="font-medium text-green-700 hover:text-green-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500">ดูคำขอ</Link> : null}
    </div>;
  }

  return <div className="flex flex-wrap justify-end gap-2" aria-label="จัดการข่าวของฉัน">
    <Link href={editHref} className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus:ring-offset-2"><Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />ขอแก้ไขข่าว</Link>
    <NewsDeleteRequestButton newsId={newsId} />
  </div>;
}

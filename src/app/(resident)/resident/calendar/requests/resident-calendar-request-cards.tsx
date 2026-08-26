import Link from "next/link";
import { CalendarDays, Globe2, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING: "warning", APPROVED: "success", REJECTED: "danger",
};

function VisibilityMetadata({ isPublic }: { isPublic: boolean }) {
  return isPublic
    ? <span className="inline-flex items-center gap-1"><Globe2 className="h-3.5 w-3.5" aria-hidden="true" />สาธารณะ</span>
    : <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" />เฉพาะลูกบ้าน</span>;
}

function ScheduleMetadata({ schedule }: { schedule: string }) {
  return <span className="inline-flex min-w-0 items-center gap-1"><CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0">{schedule}</span></span>;
}

type RequestCardProps = {
  href: string;
  status: string;
  statusLabel: string;
  typeLabel: string;
  title: string;
  schedule: string;
  location?: string | null;
  isPublic: boolean;
  submittedAt: string;
  reviewedAt?: string;
  note?: string | null;
};

export function ResidentCalendarRequestCard({ href, status, statusLabel, typeLabel, title, schedule, location, isPublic, submittedAt, reviewedAt, note }: RequestCardProps) {
  return <article className="rounded-xl border border-gray-200 bg-white transition hover:border-gray-300 hover:shadow-sm">
    <Link href={href} className="group block p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-600 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5"><Badge variant={statusVariant[status] ?? "default"}>{statusLabel}</Badge><span className="text-sm text-gray-500">{typeLabel}</span></div>
        <time className="shrink-0 text-xs text-gray-400">ส่งเมื่อ {submittedAt}</time>
      </div>
      <h2 className="mt-2 break-words font-semibold leading-6 text-gray-900 transition-colors group-hover:text-green-700">{title}</h2>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-sm text-gray-600">
        <ScheduleMetadata schedule={schedule} />
        {location ? <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{location}</span></span> : null}
        <VisibilityMetadata isPublic={isPublic} />
      </div>
      {reviewedAt ? <p className="mt-2 text-sm text-gray-600">พิจารณาเมื่อ {reviewedAt}</p> : null}
      {note ? <p className="mt-1 line-clamp-2 text-sm text-gray-600">{status === "REJECTED" ? "เหตุผล: " : "หมายเหตุ: "}{note}</p> : null}
    </Link>
  </article>;
}

type PublishedCardProps = {
  href: string;
  title: string;
  schedule: string;
  location?: string | null;
  isPublic: boolean;
  hasPendingRequest: boolean;
};

export function ResidentPublishedCalendarCard({ href, title, schedule, location, isPublic, hasPendingRequest }: PublishedCardProps) {
  return <article className="rounded-xl border border-gray-200 bg-white transition hover:border-gray-300 hover:shadow-sm">
    <Link href={href} className="group block p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-600 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-500"><VisibilityMetadata isPublic={isPublic} />{hasPendingRequest ? <span className="text-amber-700">มีคำขอรอพิจารณา</span> : null}</div>
      <h2 className="mt-2 break-words font-semibold leading-6 text-gray-900 transition-colors group-hover:text-green-700">{title}</h2>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-sm text-gray-600">
        <ScheduleMetadata schedule={schedule} />
        {location ? <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{location}</span></span> : null}
      </div>
    </Link>
  </article>;
}

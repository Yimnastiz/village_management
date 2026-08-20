import Link from "next/link";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatThaiDateTime } from "@/lib/utils";

interface ResidentAppointmentCardProps {
  id: string;
  title: string;
  stageLabel: string;
  stageVariant: "default" | "info" | "success" | "warning" | "danger";
  source: string;
  scheduledAt: Date | null;
  isConfirmed: boolean;
  preferredTime: string | null;
  createdAt: Date;
}

export function ResidentAppointmentCard({ id, title, stageLabel, stageVariant, source, scheduledAt, isConfirmed, preferredTime, createdAt }: ResidentAppointmentCardProps) {
  return <article className="relative rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md">
    <Link href={`/resident/appointments/${id}`} aria-label={`ดูรายละเอียดนัดหมาย ${title}`} className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2" />
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 text-base font-semibold text-gray-900 sm:text-lg">{title}</h2>
          <Badge variant={stageVariant}>{stageLabel}</Badge>
        </div>
        <p className="mt-1 text-sm text-gray-500">{source}</p>
      </div>
      <div className="min-w-0 space-y-1.5 text-sm text-gray-600 sm:text-right">
        {scheduledAt ? <p className="flex items-start gap-1.5 font-medium text-gray-700 sm:justify-end"><Clock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" /><span>{isConfirmed ? "นัดหมาย" : "เสนอเวลา"}: {formatThaiDateTime(scheduledAt)}</span></p> : preferredTime ? <p>ช่วงเวลาที่สะดวก: {preferredTime}</p> : null}
        <p className="text-xs text-gray-400">ส่งเมื่อ {formatThaiDateTime(createdAt)}</p>
      </div>
    </div>
  </article>;
}

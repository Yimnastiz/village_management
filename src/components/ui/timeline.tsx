import { formatThaiDateTime } from "@/lib/utils";

interface TimelineItem {
  id: string;
  action: string;
  description?: string | null;
  actorId?: string | null;
  createdAt: Date | string;
}

interface TimelineProps {
  items: TimelineItem[];
}

export function Timeline({ items }: TimelineProps) {
  return (
    <ol className="relative border-l border-gray-200 ml-3">
      {items.map((item, index) => (
        <li key={item.id} className={`mb-6 ml-6 ${index === items.length - 1 ? "mb-0" : ""}`}>
          <span className="absolute flex items-center justify-center w-6 h-6 bg-green-100 rounded-full -left-3 ring-4 ring-white">
            <div className="w-2 h-2 bg-green-600 rounded-full" />
          </span>
          <p className="font-medium text-sm text-gray-900">{item.action}</p>
          {item.description && (
            <p className="text-sm text-gray-600 mt-0.5">{item.description}</p>
          )}
          <time className="text-xs text-gray-400 mt-1 block">
            {formatThaiDateTime(item.createdAt)}
          </time>
        </li>
      ))}
    </ol>
  );
}

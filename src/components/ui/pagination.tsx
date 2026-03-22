import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className={cn(
          "px-3 py-1 rounded-lg text-sm border",
          page <= 1
            ? "text-gray-300 border-gray-200 cursor-not-allowed"
            : "text-gray-700 border-gray-300 hover:bg-gray-50"
        )}
      >
        ก่อนหน้า
      </button>
      <span className="text-sm text-gray-600">
        หน้า {page} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className={cn(
          "px-3 py-1 rounded-lg text-sm border",
          page >= totalPages
            ? "text-gray-300 border-gray-200 cursor-not-allowed"
            : "text-gray-700 border-gray-300 hover:bg-gray-50"
        )}
      >
        ถัดไป
      </button>
    </div>
  );
}

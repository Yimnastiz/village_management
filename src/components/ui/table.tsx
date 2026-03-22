import { cn } from "@/lib/utils";

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("min-w-full divide-y divide-gray-200", className)}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }: TableProps) {
  return <thead className="bg-gray-50">{children}</thead>;
}

export function TableBody({ children }: TableProps) {
  return <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>;
}

export function TableRow({ children, className }: TableProps) {
  return <tr className={cn("hover:bg-gray-50 transition-colors", className)}>{children}</tr>;
}

export function Th({ children, className }: TableProps) {
  return (
    <th className={cn("px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: TableProps) {
  return (
    <td className={cn("px-4 py-3 text-sm text-gray-900", className)}>
      {children}
    </td>
  );
}

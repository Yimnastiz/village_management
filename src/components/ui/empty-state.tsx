import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "admin";
}

export function EmptyState({ icon: Icon, title, description, action, variant = "admin" }: EmptyStateProps) {
  return (
    <div className={variant === "admin" ? "flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-10 text-center" : "flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-5 py-12 text-center"}>
      {Icon && (
        variant === "admin" ? <Icon className="mb-3 h-8 w-8 text-gray-300" /> : <div className="mb-4 rounded-full bg-gray-100 p-4"><Icon className="h-8 w-8 text-gray-400" /></div>
      )}
      <h3 className="text-base font-medium text-gray-800">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

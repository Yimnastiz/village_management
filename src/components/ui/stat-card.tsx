import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  color?: "green" | "blue" | "yellow" | "red" | "purple";
  className?: string;
}

const colorClasses = {
  green: "bg-green-50 text-green-600",
  blue: "bg-blue-50 text-blue-600",
  yellow: "bg-yellow-50 text-yellow-600",
  red: "bg-red-50 text-red-600",
  purple: "bg-purple-50 text-purple-600",
};

export function StatCard({ title, value, icon: Icon, trend, color = "green", className }: StatCardProps) {
  return (
    <div className={cn("bg-white rounded-xl shadow-sm border border-gray-200 p-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {trend && <p className="text-xs text-gray-400 mt-1">{trend}</p>}
        </div>
        <div className={cn("p-3 rounded-lg", colorClasses[color])}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

/** A shared, responsive heading area for application pages. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
        {description ? <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">{actions}</div> : null}
    </header>
  );
}

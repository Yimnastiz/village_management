import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Lets a list toolbar attach to the workspace Topbar while the shared layout
 * continues to provide comfortable padding to normal detail pages.
 */
export function WorkspaceListPage({ children }: { children: ReactNode }) {
  return <div className="workspace-list-page -mt-4 sm:-mt-6">{children}</div>;
}

/**
 * Shared data workspace for village-management lists. The toolbar stays
 * inside the page padding while this surface uses the available width and
 * height for the actual dataset.
 */
export function WorkspaceTable({ children, className, empty = false }: { children: ReactNode; className?: string; empty?: boolean }) {
  return (
    <section className={cn("-mx-4 flex min-h-0 flex-1 flex-col overflow-hidden border-y border-slate-200 bg-white sm:-mx-6 sm:border-x", empty && "min-h-[8rem] items-center justify-center", className)}>
      {children}
    </section>
  );
}

export function WorkspaceTableScroll({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-h-0 flex-1 overflow-auto", className)}>{children}</div>;
}

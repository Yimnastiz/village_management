"use client";

/* eslint-disable react-hooks/set-state-in-effect -- route changes must expand the active workspace group. */

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  isVillageWorkspaceLinkActive,
  villageWorkspaceHref,
  villageWorkspaceMenuGroups,
  villageWorkspaceOverview,
} from "./village-workspace-menu";

export function SuperAdminVillageSidebar({ villageId }: { villageId: string }) {
  const pathname = usePathname();
  const idPrefix = useId();
  const activeGroupIndex = useMemo(
    () => villageWorkspaceMenuGroups.findIndex((group) =>
      group.links.some((link) => isVillageWorkspaceLinkActive(pathname, villageWorkspaceHref(villageId, link.slug))),
    ),
    [pathname, villageId],
  );
  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>(() =>
    activeGroupIndex >= 0 ? { [activeGroupIndex]: true } : {},
  );

  useEffect(() => {
    if (activeGroupIndex >= 0) {
      setOpenGroups((current) => current[activeGroupIndex] ? current : { ...current, [activeGroupIndex]: true });
    }
  }, [activeGroupIndex]);

  const overviewHref = villageWorkspaceHref(villageId, villageWorkspaceOverview.slug);

  return (
    <aside className="sidebar-scroll sticky top-16 hidden h-[calc(100dvh-4rem)] w-[210px] shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50/80 py-3 md:block" aria-label="เมนูหมู่บ้าน">
      <nav className="space-y-1 px-2">
        <Link
          href={overviewHref}
          aria-current={isVillageWorkspaceLinkActive(pathname, overviewHref) ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isVillageWorkspaceLinkActive(pathname, overviewHref)
              ? "bg-cyan-50 text-cyan-800 ring-1 ring-inset ring-cyan-100"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
          )}
        >
          <villageWorkspaceOverview.icon className="h-4 w-4" aria-hidden="true" />
          {villageWorkspaceOverview.label}
        </Link>

        {villageWorkspaceMenuGroups.map((group, index) => {
          const panelId = `${idPrefix}-group-${index}`;
          const isOpen = Boolean(openGroups[index]);
          const isCurrentGroup = activeGroupIndex === index;

          return (
            <div key={group.label} className="pt-2">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenGroups((current) => ({ ...current, [index]: isCurrentGroup ? true : !isOpen }))}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
              >
                <span className="min-w-0 flex-1">{group.label}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
              </button>
              <div id={panelId} className={cn("grid transition-[grid-template-rows] duration-150", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                <div className="min-h-0 overflow-hidden">
                  <div className="space-y-0.5 pb-1 pt-0.5">
                    {group.links.map((link) => {
                      const href = villageWorkspaceHref(villageId, link.slug);
                      const active = isVillageWorkspaceLinkActive(pathname, href);
                      return (
                        <Link
                          key={link.slug}
                          href={href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                            active
                              ? "bg-cyan-50 font-medium text-cyan-800 ring-1 ring-inset ring-cyan-100"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                          )}
                        >
                          <link.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="min-w-0 truncate">{link.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

"use client";

import type { ReactNode } from "react";
import { ResidentPageToolbar } from "@/components/resident/resident-page-toolbar";

type PublicPageToolbarProps = {
  namespace: string;
  keyword: string;
  placeholder: string;
  suggestions?: string[];
  activeFilterCount?: number;
  filters?: ReactNode;
};

/** Compact public list controls. Page context is supplied by the public Topbar. */
export function PublicPageToolbar({ namespace, keyword, placeholder, suggestions, activeFilterCount = 0, filters }: PublicPageToolbarProps) {
  return <ResidentPageToolbar
    namespace={namespace}
    hideHeading
    search={{ keyword, placeholder, label: "ค้นหา", suggestions }}
    activeFilterCount={activeFilterCount}
    filters={filters}
    className="mx-0 mt-0 rounded-lg border-x px-3 py-2 sm:px-4 sm:py-2.5"
  />;
}

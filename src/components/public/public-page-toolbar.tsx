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
    className="-mx-4 mt-0 rounded-none border-x-0 px-3 py-2 sm:-mx-6 sm:px-4 sm:py-2.5 lg:-mx-8 lg:px-8"
  />;
}

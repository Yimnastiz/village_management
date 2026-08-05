"use client";

import type { ReactNode } from "react";
import { ResidentPageToolbar } from "@/components/resident/resident-page-toolbar";

type PublicPageToolbarProps = {
  namespace: string;
  title: string;
  description: string;
  keyword: string;
  placeholder: string;
  suggestions?: string[];
  activeFilterCount?: number;
  filters?: ReactNode;
};

/** Shared public-safe list chrome. It intentionally inherits the resident toolbar's sticky and mobile behaviour. */
export function PublicPageToolbar({ namespace, title, description, keyword, placeholder, suggestions, activeFilterCount = 0, filters }: PublicPageToolbarProps) {
  return <ResidentPageToolbar
    namespace={namespace}
    title={title}
    description={description}
    search={{ keyword, placeholder, label: "ค้นหาข้อมูลสาธารณะ", suggestions }}
    activeFilterCount={activeFilterCount}
    filters={filters}
  />;
}

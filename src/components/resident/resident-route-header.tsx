"use client";

import type { ReactNode } from "react";
import { ResidentPageHeaderRegistration } from "@/components/layout/resident-page-header-context";

/** Declares a route segment's semantic title without adding visual page chrome. */
export function ResidentRouteHeader({ title, description, priority = 0, children }: { title: string; description?: string; priority?: number; children: ReactNode }) {
  return <><ResidentPageHeaderRegistration context={{ title, description }} priority={priority} />{children}</>;
}

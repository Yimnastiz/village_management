"use client";

import type { ReactNode } from "react";
import { AdminPageHeaderRegistration } from "@/components/layout/admin-page-header-context";

/** Declares an Admin route's Topbar context without introducing toolbar chrome. */
export function AdminRouteHeader({ title, priority = 1, children }: { title: string; priority?: number; children: ReactNode }) {
  return <><AdminPageHeaderRegistration context={{ title }} priority={priority} />{children}</>;
}

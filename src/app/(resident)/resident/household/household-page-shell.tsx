"use client";

import { useEffect } from "react";

export function HouseholdPageShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
    };
  }, []);

  return <div className="flex h-[calc(100dvh-var(--app-topbar-visible-offset,4rem)-2rem)] min-h-0 flex-col gap-4 overflow-hidden md:h-[calc(100dvh-7rem)] md:gap-6">{children}</div>;
}

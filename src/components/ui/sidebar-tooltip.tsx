"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

export function SidebarTooltip({ label, children, disabled = false }: { label: string; children: React.ReactNode; disabled?: boolean }) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  return (
    <span
      className="block"
      onMouseEnter={(event) => {
        if (disabled) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setPosition({ left: rect.right + 10, top: rect.top + rect.height / 2 });
      }}
      onMouseLeave={() => setPosition(null)}
      onFocus={(event) => {
        if (disabled) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setPosition({ left: rect.right + 10, top: rect.top + rect.height / 2 });
      }}
      onBlur={() => setPosition(null)}
    >
      {children}
      {position && typeof document !== "undefined" ? createPortal(
        <span role="tooltip" className="pointer-events-none fixed z-[100] -translate-y-1/2 whitespace-nowrap rounded-md bg-gray-950 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg" style={position}>{label}</span>,
        document.body,
      ) : null}
    </span>
  );
}

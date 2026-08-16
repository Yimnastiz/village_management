import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type TopNavigationLinkProps = {
  href: string;
  active: boolean;
  children: ReactNode;
  leading?: ReactNode;
  className?: string;
  activeIndicatorClassName: string;
};

/** A text-width active marker shared by public top navigations. */
export function TopNavigationLink({
  href,
  active,
  children,
  leading,
  className,
  activeIndicatorClassName,
}: TopNavigationLinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("relative inline-flex items-center", className)}
    >
      {leading}
      <span className="relative inline-flex items-center pb-2">
        {children}
        {active ? (
          <span
            aria-hidden="true"
            className={cn(
              "absolute bottom-0 left-1/2 h-1 min-w-6 w-[calc(100%-0.25rem)] -translate-x-1/2 rounded-full",
              activeIndicatorClassName,
            )}
          />
        ) : null}
      </span>
    </Link>
  );
}

export function isTopNavigationItemActive(pathname: string, href: string, homeHref: string) {
  const normalize = (value: string) => {
    let normalized = value;
    try {
      normalized = decodeURIComponent(normalized);
    } catch {
      // Retain the browser path if it contains an incomplete escape sequence.
    }
    if (!normalized.startsWith("/")) normalized = `/${normalized}`;
    return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
  };

  const currentPath = normalize(pathname);
  const itemPath = normalize(href);

  return itemPath === normalize(homeHref)
    ? currentPath === itemPath
    : currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

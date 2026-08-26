import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type PageBackLinkProps = {
  href: string;
  label: string;
  className?: string;
};

/** A compact, destination-labelled back link for page-level navigation. */
export function PageBackLink({ href, label, className }: PageBackLinkProps) {
  return <Link href={href} aria-label={label} title={label} className={cn("inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1", className)}>
    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
    <span className="hidden sm:inline">{label}</span>
  </Link>;
}

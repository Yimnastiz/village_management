export const PENDING_RESIDENT_PUBLIC_SECTIONS = [
  "news",
  "calendar",
  "gallery",
  "places",
  "downloads",
  "transparency",
  "contacts",
] as const;

export type PendingOpeningStatus =
  | "PENDING_EMAIL_VERIFICATION"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED";

export function isPendingResidentRequestEligible(input: {
  requestStatus: PendingOpeningStatus;
  requestVillageId: string;
  configuredVillageId: string;
  emailVerifiedAt: Date | null;
}): boolean {
  return input.requestStatus === "PENDING_REVIEW"
    && input.requestVillageId === input.configuredVillageId
    && Boolean(input.emailVerifiedAt);
}

/** Pending access covers list pages and a single public detail id, never request/action subtrees. */
export function isPendingResidentPathAllowed(pathname: string): boolean {
  if (pathname === "/resident" || pathname === "/resident/dashboard") return true;
  const parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (parts[0] !== "resident" || parts.length < 2 || parts.length > 3) return false;
  const isPublicSection = PENDING_RESIDENT_PUBLIC_SECTIONS.includes(
    parts[1] as (typeof PENDING_RESIDENT_PUBLIC_SECTIONS)[number],
  );
  if (!isPublicSection) return false;
  return parts.length === 2 || !["requests", "request", "request-edit", "new"].includes(parts[2]);
}

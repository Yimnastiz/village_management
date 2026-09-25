/** Village permissions available to the Headman workspace. */
export const VILLAGE_PERMISSIONS = [
  "dashboard.view",
  "news.manage",
  "news.requests.review",
  "gallery.manage",
  "gallery.requests.review",
  "places.manage",
  "places.requests.review",
  "contacts.manage",
  "contacts.requests.review",
  "downloads.manage",
  "transparency.manage",
  "calendar.manage",
  "calendar.requests.review",
  "issues.manage",
  "appointments.manage",
  "population.view",
  "population.person.manage",
  "population.house.manage",
  "population.import",
  "population.import.rollback",
  "population.export_sensitive",
  "house_account_opening.review",
  "members.view",
  "members.status.manage",
  "members.roles.manage",
  "village.settings.manage",
  "audit.view",
  "feedback.manage",
  "broadcasts.manage",
] as const;

export type VillagePermission = (typeof VILLAGE_PERMISSIONS)[number];
/** Active runtime administrator role. */
export type VillageAdminRole = "HEADMAN";

const OPERATIONAL_PERMISSIONS = [
  "dashboard.view",
  "news.manage",
  "news.requests.review",
  "gallery.manage",
  "gallery.requests.review",
  "places.manage",
  "places.requests.review",
  "contacts.manage",
  "contacts.requests.review",
  "downloads.manage",
  "transparency.manage",
  "calendar.manage",
  "calendar.requests.review",
  "issues.manage",
  "appointments.manage",
  "population.view",
  "population.person.manage",
  "population.house.manage",
  "house_account_opening.review",
  "members.view",
  "members.status.manage",
  "audit.view",
  "feedback.manage",
  "broadcasts.manage",
] as const satisfies readonly VillagePermission[];

const GOVERNANCE_PERMISSIONS = [
  "population.import",
  "population.import.rollback",
  "population.export_sensitive",
  "members.roles.manage",
  "village.settings.manage",
] as const satisfies readonly VillagePermission[];

/** The one authoritative role-to-permission matrix for the shared /admin workspace. */
export const VILLAGE_ROLE_PERMISSIONS: Readonly<Record<VillageAdminRole, ReadonlySet<VillagePermission>>> = {
  HEADMAN: new Set([...OPERATIONAL_PERMISSIONS, ...GOVERNANCE_PERMISSIONS]),
};

export function isVillageAdminRole(role: string): role is VillageAdminRole {
  return role === "HEADMAN";
}

export function hasVillagePermission(role: string | null | undefined, permission: VillagePermission): boolean {
  return Boolean(role && isVillageAdminRole(role) && VILLAGE_ROLE_PERMISSIONS[role].has(permission));
}

export function getVillagePermissions(role: string | null | undefined): ReadonlySet<VillagePermission> {
  return role && isVillageAdminRole(role) ? VILLAGE_ROLE_PERMISSIONS[role] : new Set<VillagePermission>();
}

export class VillagePermissionError extends Error {
  readonly permission: VillagePermission;

  constructor(permission: VillagePermission) {
    super(`Missing village permission: ${permission}`);
    this.permission = permission;
    this.name = "VillagePermissionError";
  }
}

/** Server callers pass their authenticated membership; callers never decide role policy. */
export function requireVillagePermission<T extends { role: string }>(context: T, permission: VillagePermission): T {
  if (!hasVillagePermission(context.role, permission)) throw new VillagePermissionError(permission);
  return context;
}

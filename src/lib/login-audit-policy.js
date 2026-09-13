/** Restrict a successful login audit to an active runtime actor in this installation's Village. */
/** @returns {import("@prisma/client").Prisma.VillageMembershipWhereInput} */
export function configuredVillageLoginAuditWhere(userId, villageId) {
  return {
    userId,
    villageId,
    status: "ACTIVE",
    role: { in: ["HEADMAN", "RESIDENT"] },
  };
}

/** Retained for historical Headman-only policy checks. */
export function configuredHeadmanLoginAuditWhere(userId, villageId) {
  return { userId, villageId, status: "ACTIVE", role: "HEADMAN" };
}

/** Mirrors the database predicate for focused policy tests and review tooling. */
export function isConfiguredActiveHeadmanMembership(membership, villageId) {
  return Boolean(
    membership &&
      membership.villageId === villageId &&
      membership.status === "ACTIVE" &&
      membership.role === "HEADMAN"
  );
}

export function isConfiguredActiveVillageActorMembership(membership, villageId) {
  return Boolean(
    membership &&
      membership.villageId === villageId &&
      membership.status === "ACTIVE" &&
      ["HEADMAN", "RESIDENT"].includes(membership.role)
  );
}

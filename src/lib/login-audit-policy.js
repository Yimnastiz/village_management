/** Restrict a successful Headman login audit to this installation's Village. */
/** @returns {import("@prisma/client").Prisma.VillageMembershipWhereInput} */
export function configuredHeadmanLoginAuditWhere(userId, villageId) {
  return {
    userId,
    villageId,
    status: "ACTIVE",
    role: "HEADMAN",
  };
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

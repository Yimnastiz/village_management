-- Phase 4C: retire obsolete runtime roles without changing historical metadata
-- or House.sourceType provenance.

-- Normalize persisted compatibility values before their enum values/columns are removed.
UPDATE "User"
SET "systemRole" = 'USER'
WHERE "systemRole" = 'SUPERADMIN';

UPDATE "PhoneRoleSeed"
SET "systemRole" = 'USER'
WHERE "systemRole" = 'SUPERADMIN';

-- Preserve every membership row, including status, houseId, and timestamps.
-- Assistant is retired as a role type; it is not promoted to Headman.
UPDATE "VillageMembership"
SET "role" = 'RESIDENT'
WHERE "role" = 'ASSISTANT_HEADMAN';

-- Prevent development seeds from recreating retired Assistant memberships.
UPDATE "PhoneRoleSeed"
SET "membershipRole" = 'RESIDENT'
WHERE "membershipRole" = 'ASSISTANT_HEADMAN';

-- PostgreSQL enum replacement for the two columns sharing VillageMembershipRole.
ALTER TABLE "VillageMembership" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "PhoneRoleSeed" ALTER COLUMN "membershipRole" DROP DEFAULT;

ALTER TYPE "VillageMembershipRole" RENAME TO "VillageMembershipRole_old";
CREATE TYPE "VillageMembershipRole" AS ENUM ('HEADMAN', 'RESIDENT');

ALTER TABLE "VillageMembership"
  ALTER COLUMN "role" TYPE "VillageMembershipRole"
  USING ("role"::text::"VillageMembershipRole");
ALTER TABLE "PhoneRoleSeed"
  ALTER COLUMN "membershipRole" TYPE "VillageMembershipRole"
  USING ("membershipRole"::text::"VillageMembershipRole");

DROP TYPE "VillageMembershipRole_old";
ALTER TABLE "VillageMembership" ALTER COLUMN "role" SET DEFAULT 'RESIDENT';
ALTER TABLE "PhoneRoleSeed" ALTER COLUMN "membershipRole" SET DEFAULT 'RESIDENT';

-- SystemRole no longer represents an active identity or authority.  Both
-- dependent columns must be gone before the obsolete enum can be dropped.
ALTER TABLE "User" DROP COLUMN "systemRole";
ALTER TABLE "PhoneRoleSeed" DROP COLUMN "systemRole";
DROP TYPE "SystemRole";

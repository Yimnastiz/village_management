-- Phase 1 scope cleanup.
-- Committee memberships and phone-role seeds are deliberately removed. They are
-- not reassigned because there is no approved mapping to another active role.
DELETE FROM "VillageMembership" WHERE "role" = 'COMMITTEE';
DELETE FROM "PhoneRoleSeed" WHERE "membershipRole" = 'COMMITTEE';

ALTER TABLE "VillageMembership" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "PhoneRoleSeed" ALTER COLUMN "membershipRole" DROP DEFAULT;

ALTER TYPE "VillageMembershipRole" RENAME TO "VillageMembershipRole_old";
CREATE TYPE "VillageMembershipRole" AS ENUM ('HEADMAN', 'ASSISTANT_HEADMAN', 'RESIDENT');

ALTER TABLE "VillageMembership"
  ALTER COLUMN "role" TYPE "VillageMembershipRole"
  USING ("role"::text::"VillageMembershipRole");
ALTER TABLE "PhoneRoleSeed"
  ALTER COLUMN "membershipRole" TYPE "VillageMembershipRole"
  USING ("membershipRole"::text::"VillageMembershipRole");

DROP TYPE "VillageMembershipRole_old";
ALTER TABLE "VillageMembership" ALTER COLUMN "role" SET DEFAULT 'RESIDENT';
ALTER TABLE "PhoneRoleSeed" ALTER COLUMN "membershipRole" SET DEFAULT 'RESIDENT';

-- Retire all persisted data owned exclusively by the removed SOS/Emergency
-- incident feature. ContactDirectory is intentionally untouched.
DELETE FROM "Notification" WHERE "type" IN ('EMERGENCY', 'SOS');
DROP TABLE "EmergencySOS";
DROP TABLE "EmergencyBroadcast";
DROP TABLE "EmergencyLocation";
DROP TYPE "EmergencyType";
DROP TYPE "EmergencyBroadcastStatus";

ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
CREATE TYPE "NotificationType" AS ENUM (
  'ISSUE_UPDATE',
  'APPOINTMENT_UPDATE',
  'NEWS',
  'BINDING_REQUEST',
  'CORRECTION_REQUEST',
  'SYSTEM'
);
ALTER TABLE "Notification"
  ALTER COLUMN "type" TYPE "NotificationType"
  USING ("type"::text::"NotificationType");
DROP TYPE "NotificationType_old";

-- The issue feedback table is the removed post-resolution scoring feature.
-- Issue messages and timeline history remain intact.
DROP TABLE "IssueFeedback";
DROP TYPE "FeedbackRating";

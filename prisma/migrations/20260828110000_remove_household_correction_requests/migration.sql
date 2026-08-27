-- Retire the deprecated Resident household/population correction-request workflow.
-- Authorized village administrators now correct House and Person registry data directly.
DROP TABLE "HouseholdCorrectionRequest";
DROP TYPE "CorrectionRequestStatus";

-- Notification and uploaded-file enum values were exclusive to the retired workflow.
DELETE FROM "Notification" WHERE "type" = 'CORRECTION_REQUEST';
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
CREATE TYPE "NotificationType" AS ENUM (
  'ISSUE_UPDATE',
  'APPOINTMENT_UPDATE',
  'NEWS',
  'BINDING_REQUEST',
  'SYSTEM'
);
ALTER TABLE "Notification"
  ALTER COLUMN "type" TYPE "NotificationType"
  USING ("type"::text::"NotificationType");
DROP TYPE "NotificationType_old";

DELETE FROM "FileObject" WHERE "ownerType" = 'CORRECTION_REQUEST';
ALTER TYPE "FileOwnerType" RENAME TO "FileOwnerType_old";
CREATE TYPE "FileOwnerType" AS ENUM (
  'ISSUE',
  'ISSUE_MESSAGE',
  'APPOINTMENT',
  'BINDING_REQUEST',
  'DOWNLOAD',
  'TRANSPARENCY',
  'GALLERY',
  'NEWS',
  'PERSON',
  'HOUSE',
  'IMPORT_JOB'
);
ALTER TABLE "FileObject"
  ALTER COLUMN "ownerType" TYPE "FileOwnerType"
  USING ("ownerType"::text::"FileOwnerType");
DROP TYPE "FileOwnerType_old";

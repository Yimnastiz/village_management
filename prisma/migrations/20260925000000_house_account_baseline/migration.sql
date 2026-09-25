-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VillageMembershipRole" AS ENUM ('HEADMAN', 'RESIDENT');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'DELETION_PENDING', 'ANONYMIZED');

-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('HEADMAN', 'RESIDENT_HOUSE');

-- CreateEnum
CREATE TYPE "HouseAccountOpeningRequestStatus" AS ENUM ('PENDING_EMAIL_VERIFICATION', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AccountEmailStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED_PENDING_REVIEW', 'ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "AccountEmailSource" AS ENUM ('OPENING_REQUEST', 'HOUSE_ACCOUNT', 'HEADMAN', 'RECOVERY');

-- CreateEnum
CREATE TYPE "EmailOtpPurpose" AS ENUM ('HOUSE_OPENING', 'HOUSE_LOGIN', 'ADD_HOUSE_EMAIL', 'HEADMAN_LOGIN', 'ACCOUNT_RECOVERY');

-- CreateEnum
CREATE TYPE "EmailOtpChallengeStatus" AS ENUM ('PENDING_DELIVERY', 'ACTIVE', 'VERIFIED', 'CONSUMED', 'LOCKED', 'EXPIRED', 'CANCELLED', 'DELIVERY_FAILED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NewsStage" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NewsVisibility" AS ENUM ('PUBLIC', 'RESIDENT_ONLY');

-- CreateEnum
CREATE TYPE "NewsSubmissionType" AS ENUM ('CREATE', 'UPDATE');

-- CreateEnum
CREATE TYPE "NewsSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VillageEventSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VillageEventSubmissionType" AS ENUM ('CREATE', 'EDIT', 'DELETE');

-- CreateEnum
CREATE TYPE "VillagePlaceCategory" AS ENUM ('TEMPLE', 'SHOP', 'FOOD', 'SERVICE', 'SCHOOL', 'CLINIC', 'GOVERNMENT', 'COMMUNITY', 'AGRICULTURE', 'ACCOMMODATION', 'TRANSPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "VillagePlaceSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VillagePlaceSubmissionType" AS ENUM ('CREATE', 'UPDATE');

-- CreateEnum
CREATE TYPE "IssueStage" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "IssuePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "IssueCategory" AS ENUM ('ROAD', 'WATER', 'ELECTRICITY', 'WASTE', 'SECURITY', 'PUBLIC_HEALTH', 'ENVIRONMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "AppointmentStage" AS ENUM ('PENDING_APPROVAL', 'TIME_SUGGESTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DownloadStage" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TransparencyStage" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PopulationImportStage" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SystemBroadcastStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContactRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContactRequestType" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ISSUE_UPDATE', 'APPOINTMENT_UPDATE', 'NEWS', 'SYSTEM');

-- CreateEnum
CREATE TYPE "FileOwnerType" AS ENUM ('ISSUE', 'ISSUE_MESSAGE', 'APPOINTMENT', 'DOWNLOAD', 'TRANSPARENCY', 'GALLERY', 'NEWS', 'PERSON', 'HOUSE', 'IMPORT_JOB');

-- CreateEnum
CREATE TYPE "FileAccessScope" AS ENUM ('PUBLIC', 'RESIDENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "HouseholdOccupancyStatus" AS ENUM ('OCCUPIED', 'VACANT', 'UNDER_CONSTRUCTION', 'DEMOLISHED');

-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('ACTIVE', 'DECEASED', 'MOVED_OUT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('MOVE_IN', 'MOVE_OUT', 'BIRTH', 'DEATH', 'TRANSFER');

-- CreateEnum
CREATE TYPE "GalleryItemSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('VIEW_SENSITIVE', 'EXPORT', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT', 'POPULATION_IMPORT_STARTED', 'POPULATION_IMPORT_VALIDATED', 'POPULATION_IMPORT_CONFIRMED', 'POPULATION_IMPORT_COMPLETED', 'POPULATION_IMPORT_PARTIAL', 'POPULATION_IMPORT_FAILED', 'POPULATION_IMPORT_ROLLBACK', 'POPULATION_EXPORT_CREATED', 'VILLAGE_CREATED_FROM_CATALOG', 'VILLAGE_CREATED_MANUAL', 'VILLAGE_CATALOG_IMPORTED', 'VILLAGE_CATALOG_UPDATED');

-- CreateEnum
CREATE TYPE "HouseSourceType" AS ENUM ('ADMIN_CREATED', 'IMPORT', 'SEED');

-- CreateEnum
CREATE TYPE "LoginOtpChallengeStatus" AS ENUM ('PENDING_SEND', 'ACTIVE', 'VERIFYING', 'SEND_FAILED', 'LOCKED', 'CONSUMED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "phoneNumberVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "accountKind" "AccountKind" NOT NULL,
    "image" TEXT,
    "consentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "deletionRequestedAt" TIMESTAMP(3),
    "scheduledDeletionAt" TIMESTAMP(3),
    "anonymizedAt" TIMESTAMP(3),
    "deletionRecoveryHash" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "activeVillageId" TEXT,
    "loginAccountEmailId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Village" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "moo" TEXT,
    "description" TEXT,
    "address" TEXT,
    "district" TEXT,
    "province" TEXT,
    "subdistrict" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "sourceNote" TEXT,
    "catalogVillageId" TEXT,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Village_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThailandVillageMaster" (
    "id" TEXT NOT NULL,
    "officialCode" TEXT,
    "lookupKey" TEXT,
    "villageName" TEXT NOT NULL,
    "normalizedName" TEXT,
    "moo" TEXT,
    "slug" TEXT,
    "provinceCode" TEXT,
    "province" TEXT NOT NULL,
    "normalizedProvince" TEXT,
    "districtCode" TEXT,
    "district" TEXT NOT NULL,
    "normalizedDistrict" TEXT,
    "subdistrictCode" TEXT,
    "subdistrict" TEXT NOT NULL,
    "normalizedSubdistrict" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "populationTotal" INTEGER,
    "malePopulation" INTEGER,
    "femalePopulation" INTEGER,
    "householdCount" INTEGER,
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThailandVillageMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VillageMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "role" "VillageMembershipRole" NOT NULL DEFAULT 'RESIDENT',
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "houseId" TEXT,
    "joinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VillageMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VillageZone" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VillageZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "House" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "zoneId" TEXT,
    "houseNumber" TEXT NOT NULL,
    "normalizedHouseNumber" TEXT NOT NULL,
    "address" TEXT,
    "occupancyStatus" "HouseholdOccupancyStatus" NOT NULL DEFAULT 'OCCUPIED',
    "sourceType" "HouseSourceType" NOT NULL DEFAULT 'ADMIN_CREATED',
    "sourceNote" TEXT,
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "House_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResidentHouseAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResidentHouseAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseAccountOpeningRequest" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "applicantFirstName" TEXT NOT NULL,
    "applicantLastName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "emailSnapshot" TEXT NOT NULL,
    "normalizedEmailSnapshot" TEXT NOT NULL,
    "status" "HouseAccountOpeningRequestStatus" NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION',
    "requestedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "rejectionReason" TEXT,
    "activatedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseAccountOpeningRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountEmail" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "status" "AccountEmailStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "source" "AccountEmailSource" NOT NULL,
    "userId" TEXT,
    "residentHouseAccountId" TEXT,
    "openingRequestId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseAccountLoginFlow" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT,
    "houseId" TEXT,
    "accountEmailId" TEXT,
    "callbackUrl" TEXT,
    "maskedEmail" TEXT NOT NULL,
    "ipHash" TEXT,
    "emailHash" TEXT,
    "houseNumberHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resendAvailableAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseAccountLoginFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailOtpChallenge" (
    "id" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "purpose" "EmailOtpPurpose" NOT NULL,
    "accountEmailId" TEXT,
    "userId" TEXT,
    "codeHash" TEXT NOT NULL,
    "codeSalt" TEXT NOT NULL,
    "status" "EmailOtpChallengeStatus" NOT NULL DEFAULT 'PENDING_DELIVERY',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL,
    "resendCount" INTEGER NOT NULL DEFAULT 0,
    "maxResends" INTEGER NOT NULL,
    "lastSentAt" TIMESTAMP(3),
    "resendAvailableAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "houseId" TEXT,
    "villageId" TEXT,
    "nationalId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE',
    "profilePhoto" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonMovement" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "houseId" TEXT,
    "populationImportJobId" TEXT,
    "movementType" "MovementType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "News" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "coverUrl" TEXT,
    "imageUrls" JSONB,
    "stage" "NewsStage" NOT NULL DEFAULT 'DRAFT',
    "visibility" "NewsVisibility" NOT NULL DEFAULT 'PUBLIC',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "News_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsSubmission" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "type" "NewsSubmissionType" NOT NULL,
    "status" "NewsSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "targetNewsId" TEXT,
    "payload" JSONB NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsTarget" (
    "id" TEXT NOT NULL,
    "newsId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,

    CONSTRAINT "NewsTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsRead" (
    "id" TEXT NOT NULL,
    "newsId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrls" JSONB,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "category" "IssueCategory" NOT NULL DEFAULT 'OTHER',
    "priority" "IssuePriority" NOT NULL DEFAULT 'MEDIUM',
    "stage" "IssueStage" NOT NULL DEFAULT 'OPEN',
    "assigneeId" TEXT,
    "location" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueMessage" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssueMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueTimeline" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentSlot" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "maxCapacity" INTEGER NOT NULL DEFAULT 1,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "slotId" TEXT,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "stage" "AppointmentStage" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentTimeline" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DownloadFile" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "categoryLabel" TEXT,
    "stage" "DownloadStage" NOT NULL DEFAULT 'DRAFT',
    "visibility" "NewsVisibility" NOT NULL DEFAULT 'PUBLIC',
    "fileKey" TEXT,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DownloadFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DownloadAttachment" (
    "id" TEXT NOT NULL,
    "downloadId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileKey" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DownloadAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransparencyRecord" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "amount" DOUBLE PRECISION,
    "fiscalYear" TEXT,
    "stage" "TransparencyStage" NOT NULL DEFAULT 'DRAFT',
    "visibility" "NewsVisibility" NOT NULL DEFAULT 'PUBLIC',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransparencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VillageEvent" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VillageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VillageEventSubmission" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "type" "VillageEventSubmissionType" NOT NULL DEFAULT 'CREATE',
    "eventId" TEXT,
    "status" "VillageEventSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VillageEventSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VillagePlace" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "VillagePlaceCategory" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "address" TEXT,
    "openingHours" TEXT,
    "contactPhone" TEXT,
    "mapUrl" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "imageUrls" JSONB,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VillagePlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VillagePlaceImage" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VillagePlaceImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VillagePlaceSubmission" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "type" "VillagePlaceSubmissionType" NOT NULL DEFAULT 'CREATE',
    "targetPlaceId" TEXT,
    "approvedPlaceId" TEXT,
    "payload" JSONB NOT NULL,
    "status" "VillagePlaceSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VillagePlaceSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryAlbum" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "albumDate" TIMESTAMP(3) NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "allowResidentSubmissions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryItem" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "title" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileKey" TEXT,
    "mimeType" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "sourceSubmissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryItemSubmission" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "batchId" TEXT,
    "batchOrder" INTEGER,
    "title" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileKey" TEXT,
    "mimeType" TEXT,
    "note" TEXT,
    "status" "GalleryItemSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryItemSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactDirectory" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "category" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactDirectory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactRequest" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "category" TEXT,
    "note" TEXT,
    "type" "ContactRequestType" NOT NULL DEFAULT 'CREATE',
    "targetContactId" TEXT,
    "targetSnapshot" JSONB,
    "status" "ContactRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "deleteReason" TEXT,
    "approvedContactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FAQItem" (
    "id" TEXT NOT NULL,
    "villageId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FAQItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileObject" (
    "id" TEXT NOT NULL,
    "ownerType" "FileOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "accessScope" "FileAccessScope" NOT NULL DEFAULT 'RESIDENT',
    "fileKey" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PopulationImportJob" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileKey" TEXT,
    "stage" "PopulationImportStage" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "createdRows" INTEGER NOT NULL DEFAULT 0,
    "updatedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "conflictRows" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "sourceRows" JSONB,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "supportReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PopulationImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "villageId" TEXT,
    "userId" TEXT NOT NULL,
    "systemBroadcastId" TEXT,
    "type" "NotificationType" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemBroadcast" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "SystemBroadcastStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "villageId" TEXT,
    "audienceCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT NOT NULL DEFAULT 'ขณะนี้ระบบอยู่ระหว่างการปรับปรุง กรุณาลองใหม่อีกครั้งภายหลัง',
    "registrationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "publicFeedbackEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "villageId" TEXT,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthVerification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginOtpChallenge" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "otpIdentifier" TEXT NOT NULL,
    "challengeToken" TEXT NOT NULL,
    "status" "LoginOtpChallengeStatus" NOT NULL DEFAULT 'PENDING_SEND',
    "otpSentAt" TIMESTAMP(3),
    "otpExpiresAt" TIMESTAMP(3),
    "resendAvailableAt" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "sendWindowStartedAt" TIMESTAMP(3) NOT NULL,
    "sendCount" INTEGER NOT NULL DEFAULT 0,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountDeletionChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "otpSentAt" TIMESTAMP(3) NOT NULL,
    "otpExpiresAt" TIMESTAMP(3) NOT NULL,
    "resendAvailableAt" TIMESTAMP(3) NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountDeletionChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newsId" TEXT,
    "downloadId" TEXT,
    "issueId" TEXT,
    "galleryAlbumId" TEXT,
    "transparencyId" TEXT,
    "contactId" TEXT,
    "placeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_phoneNumber_idx" ON "User"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_token_key" ON "AuthSession"("token");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_token_idx" ON "AuthSession"("token");

-- CreateIndex
CREATE INDEX "AuthSession_loginAccountEmailId_idx" ON "AuthSession"("loginAccountEmailId");

-- CreateIndex
CREATE INDEX "AuthAccount_userId_idx" ON "AuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAccount_providerId_accountId_key" ON "AuthAccount"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Village_slug_key" ON "Village"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "village_catalog_village_id_key" ON "Village"("catalogVillageId");

-- CreateIndex
CREATE INDEX "Village_slug_idx" ON "Village"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "village_area_moo_key" ON "Village"("province", "district", "subdistrict", "moo");

-- CreateIndex
CREATE UNIQUE INDEX "tvm_official_code_key" ON "ThailandVillageMaster"("officialCode");

-- CreateIndex
CREATE UNIQUE INDEX "tvm_lookup_key" ON "ThailandVillageMaster"("lookupKey");

-- CreateIndex
CREATE UNIQUE INDEX "tvm_slug_key" ON "ThailandVillageMaster"("slug");

-- CreateIndex
CREATE INDEX "tvm_area_idx" ON "ThailandVillageMaster"("province", "district", "subdistrict");

-- CreateIndex
CREATE INDEX "tvm_area_code_idx" ON "ThailandVillageMaster"("provinceCode", "districtCode", "subdistrictCode");

-- CreateIndex
CREATE INDEX "tvm_norm_area_idx" ON "ThailandVillageMaster"("normalizedProvince", "normalizedDistrict", "normalizedSubdistrict");

-- CreateIndex
CREATE INDEX "tvm_village_name_idx" ON "ThailandVillageMaster"("villageName");

-- CreateIndex
CREATE INDEX "tvm_norm_name_idx" ON "ThailandVillageMaster"("normalizedName");

-- CreateIndex
CREATE INDEX "tvm_area_name_idx" ON "ThailandVillageMaster"("province", "district", "subdistrict", "villageName");

-- CreateIndex
CREATE UNIQUE INDEX "tvm_area_name_moo_key" ON "ThailandVillageMaster"("province", "district", "subdistrict", "villageName", "moo");

-- CreateIndex
CREATE INDEX "VillageMembership_userId_idx" ON "VillageMembership"("userId");

-- CreateIndex
CREATE INDEX "VillageMembership_villageId_idx" ON "VillageMembership"("villageId");

-- CreateIndex
CREATE INDEX "VillageMembership_status_idx" ON "VillageMembership"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VillageMembership_userId_villageId_key" ON "VillageMembership"("userId", "villageId");

-- CreateIndex
CREATE INDEX "VillageZone_villageId_idx" ON "VillageZone"("villageId");

-- CreateIndex
CREATE INDEX "House_villageId_idx" ON "House"("villageId");

-- CreateIndex
CREATE UNIQUE INDEX "House_villageId_normalizedHouseNumber_key" ON "House"("villageId", "normalizedHouseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ResidentHouseAccount_userId_key" ON "ResidentHouseAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ResidentHouseAccount_houseId_key" ON "ResidentHouseAccount"("houseId");

-- CreateIndex
CREATE INDEX "ResidentHouseAccount_villageId_idx" ON "ResidentHouseAccount"("villageId");

-- CreateIndex
CREATE UNIQUE INDEX "HouseAccountOpeningRequest_activatedUserId_key" ON "HouseAccountOpeningRequest"("activatedUserId");

-- CreateIndex
CREATE INDEX "HouseAccountOpeningRequest_villageId_status_createdAt_idx" ON "HouseAccountOpeningRequest"("villageId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "HouseAccountOpeningRequest_houseId_idx" ON "HouseAccountOpeningRequest"("houseId");

-- CreateIndex
CREATE INDEX "HouseAccountOpeningRequest_reviewedByUserId_idx" ON "HouseAccountOpeningRequest"("reviewedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountEmail_normalizedEmail_key" ON "AccountEmail"("normalizedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "AccountEmail_openingRequestId_key" ON "AccountEmail"("openingRequestId");

-- CreateIndex
CREATE INDEX "AccountEmail_status_idx" ON "AccountEmail"("status");

-- CreateIndex
CREATE INDEX "AccountEmail_userId_idx" ON "AccountEmail"("userId");

-- CreateIndex
CREATE INDEX "AccountEmail_residentHouseAccountId_idx" ON "AccountEmail"("residentHouseAccountId");

-- CreateIndex
CREATE INDEX "AccountEmail_createdByUserId_idx" ON "AccountEmail"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "HouseAccountLoginFlow_challengeId_key" ON "HouseAccountLoginFlow"("challengeId");

-- CreateIndex
CREATE INDEX "HouseAccountLoginFlow_ipHash_createdAt_idx" ON "HouseAccountLoginFlow"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "HouseAccountLoginFlow_emailHash_createdAt_idx" ON "HouseAccountLoginFlow"("emailHash", "createdAt");

-- CreateIndex
CREATE INDEX "HouseAccountLoginFlow_expiresAt_idx" ON "HouseAccountLoginFlow"("expiresAt");

-- CreateIndex
CREATE INDEX "EmailOtpChallenge_normalizedEmail_purpose_createdAt_idx" ON "EmailOtpChallenge"("normalizedEmail", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "EmailOtpChallenge_status_expiresAt_idx" ON "EmailOtpChallenge"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "EmailOtpChallenge_accountEmailId_idx" ON "EmailOtpChallenge"("accountEmailId");

-- CreateIndex
CREATE INDEX "EmailOtpChallenge_userId_idx" ON "EmailOtpChallenge"("userId");

-- CreateIndex
CREATE INDEX "EmailOtpChallenge_ipHash_createdAt_idx" ON "EmailOtpChallenge"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "Person_houseId_idx" ON "Person"("houseId");

-- CreateIndex
CREATE INDEX "Person_nationalId_idx" ON "Person"("nationalId");

-- CreateIndex
CREATE INDEX "PersonMovement_personId_idx" ON "PersonMovement"("personId");

-- CreateIndex
CREATE INDEX "PersonMovement_houseId_idx" ON "PersonMovement"("houseId");

-- CreateIndex
CREATE INDEX "PersonMovement_populationImportJobId_idx" ON "PersonMovement"("populationImportJobId");

-- CreateIndex
CREATE INDEX "News_villageId_idx" ON "News"("villageId");

-- CreateIndex
CREATE INDEX "News_stage_idx" ON "News"("stage");

-- CreateIndex
CREATE INDEX "News_publishedAt_idx" ON "News"("publishedAt");

-- CreateIndex
CREATE INDEX "NewsSubmission_villageId_idx" ON "NewsSubmission"("villageId");

-- CreateIndex
CREATE INDEX "NewsSubmission_requesterId_idx" ON "NewsSubmission"("requesterId");

-- CreateIndex
CREATE INDEX "NewsSubmission_status_idx" ON "NewsSubmission"("status");

-- CreateIndex
CREATE INDEX "NewsSubmission_type_idx" ON "NewsSubmission"("type");

-- CreateIndex
CREATE UNIQUE INDEX "NewsTarget_newsId_targetId_key" ON "NewsTarget"("newsId", "targetId");

-- CreateIndex
CREATE INDEX "NewsRead_userId_idx" ON "NewsRead"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsRead_newsId_userId_key" ON "NewsRead"("newsId", "userId");

-- CreateIndex
CREATE INDEX "Issue_villageId_idx" ON "Issue"("villageId");

-- CreateIndex
CREATE INDEX "Issue_reporterId_idx" ON "Issue"("reporterId");

-- CreateIndex
CREATE INDEX "Issue_stage_idx" ON "Issue"("stage");

-- CreateIndex
CREATE INDEX "Issue_category_idx" ON "Issue"("category");

-- CreateIndex
CREATE INDEX "Issue_isPublic_idx" ON "Issue"("isPublic");

-- CreateIndex
CREATE INDEX "IssueMessage_issueId_idx" ON "IssueMessage"("issueId");

-- CreateIndex
CREATE INDEX "IssueTimeline_issueId_idx" ON "IssueTimeline"("issueId");

-- CreateIndex
CREATE INDEX "AppointmentSlot_villageId_idx" ON "AppointmentSlot"("villageId");

-- CreateIndex
CREATE INDEX "AppointmentSlot_date_idx" ON "AppointmentSlot"("date");

-- CreateIndex
CREATE INDEX "Appointment_villageId_idx" ON "Appointment"("villageId");

-- CreateIndex
CREATE INDEX "Appointment_userId_idx" ON "Appointment"("userId");

-- CreateIndex
CREATE INDEX "Appointment_stage_idx" ON "Appointment"("stage");

-- CreateIndex
CREATE INDEX "AppointmentTimeline_appointmentId_idx" ON "AppointmentTimeline"("appointmentId");

-- CreateIndex
CREATE INDEX "DownloadFile_villageId_idx" ON "DownloadFile"("villageId");

-- CreateIndex
CREATE INDEX "DownloadFile_stage_idx" ON "DownloadFile"("stage");

-- CreateIndex
CREATE INDEX "DownloadFile_visibility_idx" ON "DownloadFile"("visibility");

-- CreateIndex
CREATE INDEX "DownloadFile_category_idx" ON "DownloadFile"("category");

-- CreateIndex
CREATE INDEX "DownloadAttachment_downloadId_sortOrder_idx" ON "DownloadAttachment"("downloadId", "sortOrder");

-- CreateIndex
CREATE INDEX "TransparencyRecord_villageId_idx" ON "TransparencyRecord"("villageId");

-- CreateIndex
CREATE INDEX "TransparencyRecord_stage_idx" ON "TransparencyRecord"("stage");

-- CreateIndex
CREATE INDEX "TransparencyRecord_visibility_idx" ON "TransparencyRecord"("visibility");

-- CreateIndex
CREATE INDEX "VillageEvent_villageId_idx" ON "VillageEvent"("villageId");

-- CreateIndex
CREATE INDEX "VillageEvent_createdById_idx" ON "VillageEvent"("createdById");

-- CreateIndex
CREATE INDEX "VillageEvent_startsAt_idx" ON "VillageEvent"("startsAt");

-- CreateIndex
CREATE INDEX "VillageEvent_isPublic_idx" ON "VillageEvent"("isPublic");

-- CreateIndex
CREATE INDEX "VillageEventSubmission_villageId_idx" ON "VillageEventSubmission"("villageId");

-- CreateIndex
CREATE INDEX "VillageEventSubmission_requesterId_idx" ON "VillageEventSubmission"("requesterId");

-- CreateIndex
CREATE INDEX "VillageEventSubmission_status_idx" ON "VillageEventSubmission"("status");

-- CreateIndex
CREATE INDEX "VillageEventSubmission_eventId_idx" ON "VillageEventSubmission"("eventId");

-- CreateIndex
CREATE INDEX "VillageEventSubmission_startsAt_idx" ON "VillageEventSubmission"("startsAt");

-- CreateIndex
CREATE INDEX "VillagePlace_villageId_idx" ON "VillagePlace"("villageId");

-- CreateIndex
CREATE INDEX "VillagePlace_category_idx" ON "VillagePlace"("category");

-- CreateIndex
CREATE INDEX "VillagePlace_isPublic_idx" ON "VillagePlace"("isPublic");

-- CreateIndex
CREATE INDEX "VillagePlace_isFeatured_idx" ON "VillagePlace"("isFeatured");

-- CreateIndex
CREATE INDEX "VillagePlaceImage_placeId_sortOrder_idx" ON "VillagePlaceImage"("placeId", "sortOrder");

-- CreateIndex
CREATE INDEX "VillagePlaceSubmission_villageId_idx" ON "VillagePlaceSubmission"("villageId");

-- CreateIndex
CREATE INDEX "VillagePlaceSubmission_requesterId_idx" ON "VillagePlaceSubmission"("requesterId");

-- CreateIndex
CREATE INDEX "VillagePlaceSubmission_type_idx" ON "VillagePlaceSubmission"("type");

-- CreateIndex
CREATE INDEX "VillagePlaceSubmission_targetPlaceId_idx" ON "VillagePlaceSubmission"("targetPlaceId");

-- CreateIndex
CREATE INDEX "VillagePlaceSubmission_approvedPlaceId_idx" ON "VillagePlaceSubmission"("approvedPlaceId");

-- CreateIndex
CREATE INDEX "VillagePlaceSubmission_status_idx" ON "VillagePlaceSubmission"("status");

-- CreateIndex
CREATE INDEX "GalleryAlbum_villageId_idx" ON "GalleryAlbum"("villageId");

-- CreateIndex
CREATE INDEX "GalleryAlbum_albumDate_idx" ON "GalleryAlbum"("albumDate");

-- CreateIndex
CREATE UNIQUE INDEX "GalleryItem_sourceSubmissionId_key" ON "GalleryItem"("sourceSubmissionId");

-- CreateIndex
CREATE INDEX "GalleryItem_albumId_idx" ON "GalleryItem"("albumId");

-- CreateIndex
CREATE INDEX "GalleryItem_albumId_sortOrder_idx" ON "GalleryItem"("albumId", "sortOrder");

-- CreateIndex
CREATE INDEX "GalleryItemSubmission_albumId_idx" ON "GalleryItemSubmission"("albumId");

-- CreateIndex
CREATE INDEX "GalleryItemSubmission_requesterId_idx" ON "GalleryItemSubmission"("requesterId");

-- CreateIndex
CREATE INDEX "GalleryItemSubmission_status_idx" ON "GalleryItemSubmission"("status");

-- CreateIndex
CREATE INDEX "GalleryItemSubmission_batchId_idx" ON "GalleryItemSubmission"("batchId");

-- CreateIndex
CREATE INDEX "GalleryItemSubmission_albumId_batchId_idx" ON "GalleryItemSubmission"("albumId", "batchId");

-- CreateIndex
CREATE INDEX "ContactDirectory_villageId_idx" ON "ContactDirectory"("villageId");

-- CreateIndex
CREATE INDEX "ContactRequest_villageId_status_idx" ON "ContactRequest"("villageId", "status");

-- CreateIndex
CREATE INDEX "ContactRequest_requesterId_createdAt_idx" ON "ContactRequest"("requesterId", "createdAt");

-- CreateIndex
CREATE INDEX "ContactRequest_approvedContactId_idx" ON "ContactRequest"("approvedContactId");

-- CreateIndex
CREATE INDEX "ContactRequest_targetContactId_requesterId_status_idx" ON "ContactRequest"("targetContactId", "requesterId", "status");

-- CreateIndex
CREATE INDEX "FAQItem_villageId_idx" ON "FAQItem"("villageId");

-- CreateIndex
CREATE INDEX "FileObject_ownerType_ownerId_idx" ON "FileObject"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "FileObject_fileKey_idx" ON "FileObject"("fileKey");

-- CreateIndex
CREATE INDEX "PopulationImportJob_villageId_idx" ON "PopulationImportJob"("villageId");

-- CreateIndex
CREATE INDEX "PopulationImportJob_stage_idx" ON "PopulationImportJob"("stage");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE INDEX "Notification_systemBroadcastId_idx" ON "Notification"("systemBroadcastId");

-- CreateIndex
CREATE INDEX "SystemBroadcast_createdAt_idx" ON "SystemBroadcast"("createdAt");

-- CreateIndex
CREATE INDEX "SystemBroadcast_status_createdAt_idx" ON "SystemBroadcast"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SystemBroadcast_expiresAt_idx" ON "SystemBroadcast"("expiresAt");

-- CreateIndex
CREATE INDEX "SystemBroadcast_villageId_createdAt_idx" ON "SystemBroadcast"("villageId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_villageId_idx" ON "AuditLog"("villageId");

-- CreateIndex
CREATE INDEX "AuditLog_villageId_createdAt_idx" ON "AuditLog"("villageId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuthVerification_identifier_idx" ON "AuthVerification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "LoginOtpChallenge_phoneNumber_key" ON "LoginOtpChallenge"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LoginOtpChallenge_challengeToken_key" ON "LoginOtpChallenge"("challengeToken");

-- CreateIndex
CREATE INDEX "LoginOtpChallenge_status_idx" ON "LoginOtpChallenge"("status");

-- CreateIndex
CREATE INDEX "LoginOtpChallenge_lockedUntil_idx" ON "LoginOtpChallenge"("lockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "AccountDeletionChallenge_userId_key" ON "AccountDeletionChallenge"("userId");

-- CreateIndex
CREATE INDEX "AccountDeletionChallenge_otpExpiresAt_idx" ON "AccountDeletionChallenge"("otpExpiresAt");

-- CreateIndex
CREATE INDEX "SavedItem_userId_idx" ON "SavedItem"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedItem_userId_newsId_key" ON "SavedItem"("userId", "newsId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedItem_userId_downloadId_key" ON "SavedItem"("userId", "downloadId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedItem_userId_issueId_key" ON "SavedItem"("userId", "issueId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedItem_userId_galleryAlbumId_key" ON "SavedItem"("userId", "galleryAlbumId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedItem_userId_transparencyId_key" ON "SavedItem"("userId", "transparencyId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedItem_userId_contactId_key" ON "SavedItem"("userId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedItem_userId_placeId_key" ON "SavedItem"("userId", "placeId");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_activeVillageId_fkey" FOREIGN KEY ("activeVillageId") REFERENCES "Village"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_loginAccountEmailId_fkey" FOREIGN KEY ("loginAccountEmailId") REFERENCES "AccountEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthAccount" ADD CONSTRAINT "AuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Village" ADD CONSTRAINT "Village_catalogVillageId_fkey" FOREIGN KEY ("catalogVillageId") REFERENCES "ThailandVillageMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillageMembership" ADD CONSTRAINT "VillageMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillageMembership" ADD CONSTRAINT "VillageMembership_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillageMembership" ADD CONSTRAINT "VillageMembership_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillageZone" ADD CONSTRAINT "VillageZone_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "House" ADD CONSTRAINT "House_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "House" ADD CONSTRAINT "House_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "VillageZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResidentHouseAccount" ADD CONSTRAINT "ResidentHouseAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResidentHouseAccount" ADD CONSTRAINT "ResidentHouseAccount_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResidentHouseAccount" ADD CONSTRAINT "ResidentHouseAccount_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseAccountOpeningRequest" ADD CONSTRAINT "HouseAccountOpeningRequest_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseAccountOpeningRequest" ADD CONSTRAINT "HouseAccountOpeningRequest_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseAccountOpeningRequest" ADD CONSTRAINT "HouseAccountOpeningRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseAccountOpeningRequest" ADD CONSTRAINT "HouseAccountOpeningRequest_activatedUserId_fkey" FOREIGN KEY ("activatedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountEmail" ADD CONSTRAINT "AccountEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountEmail" ADD CONSTRAINT "AccountEmail_residentHouseAccountId_fkey" FOREIGN KEY ("residentHouseAccountId") REFERENCES "ResidentHouseAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountEmail" ADD CONSTRAINT "AccountEmail_openingRequestId_fkey" FOREIGN KEY ("openingRequestId") REFERENCES "HouseAccountOpeningRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountEmail" ADD CONSTRAINT "AccountEmail_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailOtpChallenge" ADD CONSTRAINT "EmailOtpChallenge_accountEmailId_fkey" FOREIGN KEY ("accountEmailId") REFERENCES "AccountEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailOtpChallenge" ADD CONSTRAINT "EmailOtpChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonMovement" ADD CONSTRAINT "PersonMovement_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonMovement" ADD CONSTRAINT "PersonMovement_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonMovement" ADD CONSTRAINT "PersonMovement_populationImportJobId_fkey" FOREIGN KEY ("populationImportJobId") REFERENCES "PopulationImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "News" ADD CONSTRAINT "News_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "News" ADD CONSTRAINT "News_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsSubmission" ADD CONSTRAINT "NewsSubmission_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsSubmission" ADD CONSTRAINT "NewsSubmission_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsSubmission" ADD CONSTRAINT "NewsSubmission_targetNewsId_fkey" FOREIGN KEY ("targetNewsId") REFERENCES "News"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsTarget" ADD CONSTRAINT "NewsTarget_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "News"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsRead" ADD CONSTRAINT "NewsRead_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "News"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueMessage" ADD CONSTRAINT "IssueMessage_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueTimeline" ADD CONSTRAINT "IssueTimeline_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentSlot" ADD CONSTRAINT "AppointmentSlot_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "AppointmentSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentTimeline" ADD CONSTRAINT "AppointmentTimeline_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentTimeline" ADD CONSTRAINT "AppointmentTimeline_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DownloadFile" ADD CONSTRAINT "DownloadFile_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DownloadAttachment" ADD CONSTRAINT "DownloadAttachment_downloadId_fkey" FOREIGN KEY ("downloadId") REFERENCES "DownloadFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransparencyRecord" ADD CONSTRAINT "TransparencyRecord_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillageEvent" ADD CONSTRAINT "VillageEvent_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillageEvent" ADD CONSTRAINT "VillageEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillageEventSubmission" ADD CONSTRAINT "VillageEventSubmission_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillageEventSubmission" ADD CONSTRAINT "VillageEventSubmission_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillagePlace" ADD CONSTRAINT "VillagePlace_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillagePlace" ADD CONSTRAINT "VillagePlace_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillagePlaceImage" ADD CONSTRAINT "VillagePlaceImage_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "VillagePlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillagePlaceSubmission" ADD CONSTRAINT "VillagePlaceSubmission_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillagePlaceSubmission" ADD CONSTRAINT "VillagePlaceSubmission_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryAlbum" ADD CONSTRAINT "GalleryAlbum_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryItem" ADD CONSTRAINT "GalleryItem_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "GalleryAlbum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryItem" ADD CONSTRAINT "GalleryItem_sourceSubmissionId_fkey" FOREIGN KEY ("sourceSubmissionId") REFERENCES "GalleryItemSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryItemSubmission" ADD CONSTRAINT "GalleryItemSubmission_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "GalleryAlbum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryItemSubmission" ADD CONSTRAINT "GalleryItemSubmission_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactDirectory" ADD CONSTRAINT "ContactDirectory_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_targetContactId_fkey" FOREIGN KEY ("targetContactId") REFERENCES "ContactDirectory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FAQItem" ADD CONSTRAINT "FAQItem_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PopulationImportJob" ADD CONSTRAINT "PopulationImportJob_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_systemBroadcastId_fkey" FOREIGN KEY ("systemBroadcastId") REFERENCES "SystemBroadcast"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemBroadcast" ADD CONSTRAINT "SystemBroadcast_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemBroadcast" ADD CONSTRAINT "SystemBroadcast_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "News"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_downloadId_fkey" FOREIGN KEY ("downloadId") REFERENCES "DownloadFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_galleryAlbumId_fkey" FOREIGN KEY ("galleryAlbumId") REFERENCES "GalleryAlbum"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_transparencyId_fkey" FOREIGN KEY ("transparencyId") REFERENCES "TransparencyRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ContactDirectory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "VillagePlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('SUPERADMIN', 'USER');

-- CreateEnum
CREATE TYPE "VillageMembershipRole" AS ENUM ('HEADMAN', 'ASSISTANT_HEADMAN', 'COMMITTEE', 'RESIDENT');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BindingRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NewsStage" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NewsVisibility" AS ENUM ('PUBLIC', 'RESIDENT_ONLY');

-- CreateEnum
CREATE TYPE "IssueStage" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "IssuePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "IssueCategory" AS ENUM ('ROAD', 'WATER', 'ELECTRICITY', 'WASTE', 'SECURITY', 'PUBLIC_HEALTH', 'ENVIRONMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "AppointmentStage" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CorrectionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DownloadStage" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TransparencyStage" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PopulationImportStage" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ISSUE_UPDATE', 'APPOINTMENT_UPDATE', 'NEWS', 'BINDING_REQUEST', 'CORRECTION_REQUEST', 'EMERGENCY', 'SOS', 'SYSTEM');

-- CreateEnum
CREATE TYPE "FileOwnerType" AS ENUM ('ISSUE', 'ISSUE_MESSAGE', 'APPOINTMENT', 'CORRECTION_REQUEST', 'BINDING_REQUEST', 'DOWNLOAD', 'TRANSPARENCY', 'GALLERY', 'NEWS', 'PERSON', 'HOUSE', 'IMPORT_JOB');

-- CreateEnum
CREATE TYPE "FileAccessScope" AS ENUM ('PUBLIC', 'RESIDENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "HouseholdOccupancyStatus" AS ENUM ('OCCUPIED', 'VACANT', 'UNDER_CONSTRUCTION', 'DEMOLISHED');

-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('ACTIVE', 'DECEASED', 'MOVED_OUT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('MOVE_IN', 'MOVE_OUT', 'BIRTH', 'DEATH', 'TRANSFER');

-- CreateEnum
CREATE TYPE "FeedbackRating" AS ENUM ('VERY_SATISFIED', 'SATISFIED', 'NEUTRAL', 'DISSATISFIED', 'VERY_DISSATISFIED');

-- CreateEnum
CREATE TYPE "EmergencyType" AS ENUM ('FIRE', 'FLOOD', 'ACCIDENT', 'MEDICAL', 'CRIME', 'OTHER');

-- CreateEnum
CREATE TYPE "EmergencyBroadcastStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('VIEW_SENSITIVE', 'EXPORT', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "phoneNumberVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "systemRole" "SystemRole" NOT NULL DEFAULT 'USER',
    "consentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

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
    "description" TEXT,
    "address" TEXT,
    "district" TEXT,
    "province" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Village_pkey" PRIMARY KEY ("id")
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
    "address" TEXT,
    "occupancyStatus" "HouseholdOccupancyStatus" NOT NULL DEFAULT 'OCCUPIED',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "House_pkey" PRIMARY KEY ("id")
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
    "movementType" "MovementType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BindingRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "villageId" TEXT,
    "houseId" TEXT,
    "houseNumber" TEXT,
    "note" TEXT,
    "status" "BindingRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BindingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "News" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "coverUrl" TEXT,
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
CREATE TABLE "IssueFeedback" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" "FeedbackRating" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueFeedback_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "HouseholdCorrectionRequest" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "houseId" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "CorrectionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdCorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DownloadFile" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "stage" "DownloadStage" NOT NULL DEFAULT 'DRAFT',
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
CREATE TABLE "TransparencyRecord" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "amount" DOUBLE PRECISION,
    "fiscalYear" TEXT,
    "stage" "TransparencyStage" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransparencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryAlbum" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryItem_pkey" PRIMARY KEY ("id")
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
    "errors" JSONB,
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
CREATE TABLE "EmergencyBroadcast" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "EmergencyType" NOT NULL DEFAULT 'OTHER',
    "status" "EmergencyBroadcastStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencySOS" (
    "id" TEXT NOT NULL,
    "villageId" TEXT,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "type" "EmergencyType" NOT NULL DEFAULT 'OTHER',
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencySOS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyLocation" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyLocation_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "SavedItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newsId" TEXT,
    "downloadId" TEXT,
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
CREATE INDEX "AuthAccount_userId_idx" ON "AuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAccount_providerId_accountId_key" ON "AuthAccount"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Village_slug_key" ON "Village"("slug");

-- CreateIndex
CREATE INDEX "Village_slug_idx" ON "Village"("slug");

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
CREATE UNIQUE INDEX "House_villageId_houseNumber_key" ON "House"("villageId", "houseNumber");

-- CreateIndex
CREATE INDEX "Person_houseId_idx" ON "Person"("houseId");

-- CreateIndex
CREATE INDEX "Person_nationalId_idx" ON "Person"("nationalId");

-- CreateIndex
CREATE INDEX "PersonMovement_personId_idx" ON "PersonMovement"("personId");

-- CreateIndex
CREATE INDEX "PersonMovement_houseId_idx" ON "PersonMovement"("houseId");

-- CreateIndex
CREATE INDEX "BindingRequest_userId_idx" ON "BindingRequest"("userId");

-- CreateIndex
CREATE INDEX "BindingRequest_status_idx" ON "BindingRequest"("status");

-- CreateIndex
CREATE INDEX "News_villageId_idx" ON "News"("villageId");

-- CreateIndex
CREATE INDEX "News_stage_idx" ON "News"("stage");

-- CreateIndex
CREATE INDEX "News_publishedAt_idx" ON "News"("publishedAt");

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
CREATE INDEX "IssueMessage_issueId_idx" ON "IssueMessage"("issueId");

-- CreateIndex
CREATE INDEX "IssueTimeline_issueId_idx" ON "IssueTimeline"("issueId");

-- CreateIndex
CREATE UNIQUE INDEX "IssueFeedback_issueId_key" ON "IssueFeedback"("issueId");

-- CreateIndex
CREATE INDEX "IssueFeedback_userId_idx" ON "IssueFeedback"("userId");

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
CREATE INDEX "HouseholdCorrectionRequest_villageId_idx" ON "HouseholdCorrectionRequest"("villageId");

-- CreateIndex
CREATE INDEX "HouseholdCorrectionRequest_userId_idx" ON "HouseholdCorrectionRequest"("userId");

-- CreateIndex
CREATE INDEX "HouseholdCorrectionRequest_status_idx" ON "HouseholdCorrectionRequest"("status");

-- CreateIndex
CREATE INDEX "DownloadFile_villageId_idx" ON "DownloadFile"("villageId");

-- CreateIndex
CREATE INDEX "DownloadFile_stage_idx" ON "DownloadFile"("stage");

-- CreateIndex
CREATE INDEX "TransparencyRecord_villageId_idx" ON "TransparencyRecord"("villageId");

-- CreateIndex
CREATE INDEX "TransparencyRecord_stage_idx" ON "TransparencyRecord"("stage");

-- CreateIndex
CREATE INDEX "GalleryAlbum_villageId_idx" ON "GalleryAlbum"("villageId");

-- CreateIndex
CREATE INDEX "GalleryItem_albumId_idx" ON "GalleryItem"("albumId");

-- CreateIndex
CREATE INDEX "ContactDirectory_villageId_idx" ON "ContactDirectory"("villageId");

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
CREATE INDEX "EmergencyBroadcast_villageId_idx" ON "EmergencyBroadcast"("villageId");

-- CreateIndex
CREATE INDEX "EmergencyBroadcast_status_idx" ON "EmergencyBroadcast"("status");

-- CreateIndex
CREATE INDEX "EmergencySOS_userId_idx" ON "EmergencySOS"("userId");

-- CreateIndex
CREATE INDEX "EmergencySOS_villageId_idx" ON "EmergencySOS"("villageId");

-- CreateIndex
CREATE INDEX "EmergencyLocation_villageId_idx" ON "EmergencyLocation"("villageId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_villageId_idx" ON "AuditLog"("villageId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuthVerification_identifier_idx" ON "AuthVerification"("identifier");

-- CreateIndex
CREATE INDEX "SavedItem_userId_idx" ON "SavedItem"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedItem_userId_newsId_key" ON "SavedItem"("userId", "newsId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedItem_userId_downloadId_key" ON "SavedItem"("userId", "downloadId");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_activeVillageId_fkey" FOREIGN KEY ("activeVillageId") REFERENCES "Village"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthAccount" ADD CONSTRAINT "AuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "Person" ADD CONSTRAINT "Person_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonMovement" ADD CONSTRAINT "PersonMovement_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonMovement" ADD CONSTRAINT "PersonMovement_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BindingRequest" ADD CONSTRAINT "BindingRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BindingRequest" ADD CONSTRAINT "BindingRequest_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "News" ADD CONSTRAINT "News_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "IssueFeedback" ADD CONSTRAINT "IssueFeedback_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentSlot" ADD CONSTRAINT "AppointmentSlot_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "AppointmentSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentTimeline" ADD CONSTRAINT "AppointmentTimeline_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdCorrectionRequest" ADD CONSTRAINT "HouseholdCorrectionRequest_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdCorrectionRequest" ADD CONSTRAINT "HouseholdCorrectionRequest_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DownloadFile" ADD CONSTRAINT "DownloadFile_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransparencyRecord" ADD CONSTRAINT "TransparencyRecord_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryAlbum" ADD CONSTRAINT "GalleryAlbum_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryItem" ADD CONSTRAINT "GalleryItem_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "GalleryAlbum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactDirectory" ADD CONSTRAINT "ContactDirectory_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FAQItem" ADD CONSTRAINT "FAQItem_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PopulationImportJob" ADD CONSTRAINT "PopulationImportJob_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyBroadcast" ADD CONSTRAINT "EmergencyBroadcast_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencySOS" ADD CONSTRAINT "EmergencySOS_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyLocation" ADD CONSTRAINT "EmergencyLocation_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

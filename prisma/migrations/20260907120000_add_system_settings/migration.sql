-- Typed singleton configuration for global system operations.
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT NOT NULL DEFAULT 'ขณะนี้ระบบอยู่ระหว่างการปรับปรุง กรุณาลองใหม่อีกครั้งภายหลัง',
    "registrationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "publicFeedbackEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

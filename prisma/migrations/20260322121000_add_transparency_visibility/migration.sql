-- Add visibility field to transparency records
ALTER TABLE "TransparencyRecord"
ADD COLUMN "visibility" "NewsVisibility" NOT NULL DEFAULT 'PUBLIC';

CREATE INDEX "TransparencyRecord_visibility_idx" ON "TransparencyRecord"("visibility");

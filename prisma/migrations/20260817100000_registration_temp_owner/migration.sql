ALTER TABLE "RegistrationTemp" ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE INDEX IF NOT EXISTS "RegistrationTemp_userId_idx" ON "RegistrationTemp"("userId");

ALTER TABLE "RegistrationTemp"
  ADD CONSTRAINT "RegistrationTemp_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

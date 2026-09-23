-- Resident House Accounts authenticate through verified AccountEmail aliases,
-- not the applicant's contact phone. Existing legacy and Headman phone values
-- remain unchanged and the unique constraint remains in place.
ALTER TABLE "User"
ALTER COLUMN "phoneNumber" DROP NOT NULL;

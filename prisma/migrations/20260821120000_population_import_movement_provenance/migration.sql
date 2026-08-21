-- Initialization movements created while confirming an import are explicitly
-- linked to that job. This lets rollback remove only import-owned history.
ALTER TABLE "PersonMovement"
  ADD COLUMN "populationImportJobId" TEXT;

CREATE INDEX "PersonMovement_populationImportJobId_idx"
  ON "PersonMovement"("populationImportJobId");

ALTER TABLE "PersonMovement"
  ADD CONSTRAINT "PersonMovement_populationImportJobId_fkey"
  FOREIGN KEY ("populationImportJobId") REFERENCES "PopulationImportJob"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

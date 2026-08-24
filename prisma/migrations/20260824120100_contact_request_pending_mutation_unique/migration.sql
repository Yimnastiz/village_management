CREATE UNIQUE INDEX "ContactRequest_one_pending_mutation_per_target_requester"
  ON "ContactRequest"("targetContactId", "requesterId")
  WHERE "type" IN ('UPDATE', 'DELETE') AND "status" = 'PENDING';

CREATE UNIQUE INDEX "ContactRequest_one_pending_update_per_target_requester"
  ON "ContactRequest"("targetContactId", "requesterId")
  WHERE "type" = 'UPDATE' AND "status" = 'PENDING';

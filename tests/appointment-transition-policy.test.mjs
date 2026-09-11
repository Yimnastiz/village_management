import test from "node:test";
import assert from "node:assert/strict";
import { canHeadmanCompleteAppointment } from "../src/lib/appointment-transition-policy.js";

test("only an approved appointment can be completed by the Headman", () => {
  assert.equal(canHeadmanCompleteAppointment("APPROVED"), true);
  for (const stage of ["PENDING_APPROVAL", "TIME_SUGGESTED", "REJECTED", "CANCELLED", "COMPLETED"]) {
    assert.equal(canHeadmanCompleteAppointment(stage), false);
  }
});

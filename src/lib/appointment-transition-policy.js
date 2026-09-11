/** Completion is a Headman-only terminal action after a confirmed appointment. */
export function canHeadmanCompleteAppointment(stage) {
  return stage === "APPROVED";
}

import { redirect } from "next/navigation";

/** Availability management has been retired in favour of per-request time proposals. */
export default function AppointmentSlotsPage() {
  redirect("/admin/appointments");
}

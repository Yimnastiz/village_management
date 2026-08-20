import { redirect } from "next/navigation";

/** The list hosts the single Resident request form in its modal. */
export default function NewAppointmentPage() {
  redirect("/resident/appointments");
}

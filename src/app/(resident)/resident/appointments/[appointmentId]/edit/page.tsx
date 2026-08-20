import { redirect } from "next/navigation";

/** Editing now happens in the owned-request modal on the appointment detail. */
export default async function EditAppointmentPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  redirect(`/resident/appointments/${appointmentId}`);
}

import { redirect } from "next/navigation";
import { getVillagePermissionContext } from "@/lib/admin-permission.server";

export default async function EditCalendarRequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const context = await getVillagePermissionContext("calendar.requests.review");
  const membership = context?.membership;
  if (!membership) redirect("/admin/calendar/requests");
  redirect(`/admin/calendar/requests/${requestId}`);
}

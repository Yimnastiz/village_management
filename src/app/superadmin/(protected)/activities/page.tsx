import { redirect } from "next/navigation";

export default function SuperAdminActivitiesRedirectPage() {
  redirect("/superadmin/logs?view=all");
}

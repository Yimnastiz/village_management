import { redirect } from "next/navigation";
import { isSuperAdminConfigured, readSuperAdminSessionFromServerCookies } from "@/lib/superadmin-auth";
import { SuperAdminAccessForm } from "./access-form";

export default async function SuperAdminAccessPage() {
  if (await readSuperAdminSessionFromServerCookies()) redirect("/superadmin/dashboard");
  return <SuperAdminAccessForm configured={isSuperAdminConfigured()} />;
}

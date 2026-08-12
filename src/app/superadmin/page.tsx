import { redirect } from "next/navigation";
import { readSuperAdminSessionFromServerCookies } from "@/lib/superadmin-auth";

export default async function SuperAdminRootPage() {
  redirect(await readSuperAdminSessionFromServerCookies() ? "/superadmin/dashboard" : "/superadmin/access");
}

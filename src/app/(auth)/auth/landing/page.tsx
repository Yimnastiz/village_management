import { redirect } from "next/navigation";
import { getAuthenticatedAccessRedirectPath, getSessionContextFromServerCookies } from "@/lib/access-control";

export default async function AuthLandingPage() {
  const session = await getSessionContextFromServerCookies();

  if (!session) {
    redirect("/auth/login");
  }

  redirect(await getAuthenticatedAccessRedirectPath(session));
}


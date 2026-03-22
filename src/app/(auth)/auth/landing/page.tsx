import { redirect } from "next/navigation";
import { computeLandingPath, getSessionContextFromServerCookies } from "@/lib/access-control";

export default async function AuthLandingPage() {
  const session = await getSessionContextFromServerCookies();

  if (!session) {
    redirect("/auth/login");
  }

  redirect(computeLandingPath(session));
}


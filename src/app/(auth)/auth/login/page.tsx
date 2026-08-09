import { redirect } from "next/navigation";
import { getActiveAuthRedirectPathFromServerCookies } from "@/lib/access-control";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const redirectPath = await getActiveAuthRedirectPathFromServerCookies();

  if (redirectPath) {
    redirect(redirectPath);
  }

  return <LoginForm />;
}

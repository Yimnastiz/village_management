import { redirect } from "next/navigation";
import { getActiveAuthRedirectPathFromServerCookies } from "@/lib/access-control";
import { AccountLoginVerifyForm } from "./verify-form";

export default async function AccountLoginVerifyPage() {
  const redirectPath = await getActiveAuthRedirectPathFromServerCookies();
  if (redirectPath) redirect(redirectPath);
  return <AccountLoginVerifyForm />;
}

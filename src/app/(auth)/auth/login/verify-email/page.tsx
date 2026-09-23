import { redirect } from "next/navigation";
import { getActiveAuthRedirectPathFromServerCookies } from "@/lib/access-control";
import { HouseLoginVerifyForm } from "./verify-form";

export default async function HouseLoginVerifyPage() {
  const redirectPath = await getActiveAuthRedirectPathFromServerCookies();
  if (redirectPath) redirect(redirectPath);
  return <HouseLoginVerifyForm />;
}

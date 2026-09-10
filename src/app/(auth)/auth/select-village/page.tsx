import { redirect } from "next/navigation";
import { getActiveAuthRedirectPathFromServerCookies } from "@/lib/access-control";

export default async function SelectVillagePage() {
  redirect((await getActiveAuthRedirectPathFromServerCookies()) ?? "/auth/login");
}

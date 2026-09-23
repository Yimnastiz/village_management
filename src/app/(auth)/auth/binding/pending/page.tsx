import { redirect } from "next/navigation";

export default function BindingPendingPage() {
  redirect("/auth/account-migration-required");
}

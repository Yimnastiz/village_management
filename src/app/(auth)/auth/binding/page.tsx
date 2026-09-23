import { redirect } from "next/navigation";

export default function BindingPage() {
  redirect("/auth/account-migration-required");
}

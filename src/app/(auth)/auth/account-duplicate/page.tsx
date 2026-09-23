import { redirect } from "next/navigation";

export default function RetiredDuplicateAccountPage() {
  redirect("/auth/account-migration-required");
}

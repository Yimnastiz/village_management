import { redirect } from "next/navigation";

/** System integration health is intentionally not exposed in the headman area. */
export default function Page() {
  redirect("/admin/settings");
}

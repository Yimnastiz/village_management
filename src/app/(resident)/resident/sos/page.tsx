import { redirect } from "next/navigation";

export default function ResidentSosPageRemoved() {
  redirect("/resident/dashboard");
}

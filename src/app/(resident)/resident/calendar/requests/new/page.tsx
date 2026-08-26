import { redirect } from "next/navigation";

/** Legacy create URL: calendar requests now use the shared modal. */
export default function ResidentCalendarRequestNewPage() {
  redirect("/resident/calendar/requests");
}

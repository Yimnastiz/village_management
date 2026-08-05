import { redirect } from "next/navigation";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { CalendarRequestForm } from "../request-form";

export default async function ResidentCalendarRequestNewPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ขอเพิ่มกิจกรรมหมู่บ้าน</h1>
        <p className="mt-1 text-sm text-gray-500">คำขอจะถูกส่งให้แอดมินพิจารณาก่อนเผยแพร่ในปฏิทิน</p>
      </div>
      <CalendarRequestForm />
    </div>
  );
}

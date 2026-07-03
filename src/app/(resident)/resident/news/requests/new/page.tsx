import { redirect } from "next/navigation";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { NewsRequestForm } from "../request-form";

export default async function ResidentCreateNewsRequestPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">สร้างข่าวใหม่</h1>
        <p className="text-sm text-gray-500 mt-1">ข่าวสถานะร่างจะบันทึกได้ทันที ส่วนข่าวเผยแพร่จะส่งคำขอให้แอดมินอนุมัติ</p>
      </div>
      <NewsRequestForm mode="create" />
    </div>
  );
}

import { redirect } from "next/navigation";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { PlaceRequestForm } from "../request-form";

export default async function ResidentPlaceRequestNewPage() {
  const session = await getSessionContextFromServerCookies(); if (!session?.id) redirect("/auth/login"); if (!getResidentMembership(session)) redirect("/resident/dashboard");
  return <div className="mx-auto w-full max-w-3xl space-y-4"><div><h1 className="text-2xl font-bold text-gray-900">ขอเพิ่มสถานที่</h1><p className="mt-1 text-sm text-gray-500">คำขอจะถูกส่งให้ผู้ดูแลหมู่บ้านตรวจสอบก่อนเพิ่มเข้ารายการสถานที่</p></div><PlaceRequestForm /></div>;
}

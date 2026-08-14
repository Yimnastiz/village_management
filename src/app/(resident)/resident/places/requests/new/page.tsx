import { redirect } from "next/navigation";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PlaceRequestForm } from "../request-form";

export default async function ResidentPlaceRequestNewPage() {
  const session = await getSessionContextFromServerCookies(); if (!session?.id) redirect("/auth/login"); if (!getResidentMembership(session)) redirect("/resident/dashboard");
  return <div className="mx-auto w-full max-w-3xl space-y-4"><Link href="/resident/places" className="inline-flex items-center gap-1.5 px-1 py-2 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />กลับรายการสถานที่</Link><div><h1 className="text-2xl font-bold text-gray-900">ขอเพิ่มสถานที่</h1><p className="mt-1 text-sm text-gray-500">คำขอจะถูกส่งให้ผู้ดูแลหมู่บ้านตรวจสอบก่อนเพิ่มเข้ารายการสถานที่</p></div><PlaceRequestForm cancelHref="/resident/places" allowedCategories={["SHOP", "FOOD", "SERVICE", "COMMUNITY", "AGRICULTURE", "ACCOMMODATION", "TRANSPORT", "OTHER"]} /></div>;
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ResidentPageToolbar } from "@/components/resident/resident-page-toolbar";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { PlaceRequestForm } from "../request-form";
export default async function ResidentPlaceRequestNewPage() { const session = await getSessionContextFromServerCookies(); if (!session?.id) redirect("/auth/login"); if (!getResidentMembership(session)) redirect("/resident/dashboard"); return <div className="mx-auto w-full max-w-3xl space-y-4"><ResidentPageToolbar namespace="resident-place-request-new" title="ขอเพิ่มสถานที่" actions={<Link href="/resident/places" className="inline-flex min-h-10 items-center gap-1.5 px-1 text-sm font-medium text-gray-600 hover:text-gray-900"><ArrowLeft className="h-4 w-4" />กลับรายการสถานที่</Link>} /><PlaceRequestForm cancelHref="/resident/places" allowedCategories={["SHOP", "FOOD", "SERVICE", "COMMUNITY", "AGRICULTURE", "ACCOMMODATION", "TRANSPORT", "OTHER"]} /></div>; }

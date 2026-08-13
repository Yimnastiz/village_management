import { notFound, redirect } from "next/navigation";
import { PlaceRequestForm } from "../../requests/request-form";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

export default async function ResidentPlaceRequestEditPage({ params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params; const session = await getSessionContextFromServerCookies(); if (!session?.id) redirect("/auth/login"); const membership = getResidentMembership(session); if (!membership) redirect("/resident/dashboard");
  const place = await prisma.villagePlace.findFirst({ where: { id: placeId, villageId: membership.villageId }, select: { id: true, name: true, category: true, description: true, address: true, openingHours: true, contactPhone: true, mapUrl: true, latitude: true, longitude: true, imageUrls: true } });
  if (!place) notFound(); const imageUrls = Array.isArray(place.imageUrls) ? place.imageUrls.map(String).filter(Boolean) : [];
  return <div className="mx-auto w-full max-w-3xl space-y-4"><div><h1 className="text-2xl font-bold text-gray-900">เสนอแก้ไขสถานที่</h1><p className="mt-1 text-sm text-gray-500">คำขอแก้ไขจะถูกส่งให้ผู้ดูแลหมู่บ้านพิจารณาก่อนอัปเดตข้อมูล</p></div><PlaceRequestForm mode="update" targetPlaceId={place.id} defaultValues={{ name: place.name, category: place.category, description: place.description ?? "", address: place.address ?? "", openingHours: place.openingHours ?? "", contactPhone: place.contactPhone ?? "", mapUrl: place.mapUrl ?? "", latitude: place.latitude == null ? "" : String(place.latitude), longitude: place.longitude == null ? "" : String(place.longitude), imageUrls }} /></div>;
}

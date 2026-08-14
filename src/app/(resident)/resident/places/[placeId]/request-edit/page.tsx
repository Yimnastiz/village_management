import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { PlaceRequestForm } from "../../requests/request-form";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { orderedPlaceImages } from "@/lib/place-image";

export default async function ResidentPlaceRequestEditPage({ params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params; const session = await getSessionContextFromServerCookies(); if (!session?.id) redirect("/auth/login"); const membership = getResidentMembership(session); if (!membership) redirect("/resident/dashboard");
  const place = await prisma.villagePlace.findFirst({ where: { id: placeId, villageId: membership.villageId }, select: { id: true, createdById: true, name: true, category: true, description: true, address: true, openingHours: true, contactPhone: true, mapUrl: true, latitude: true, longitude: true, imageUrls: true, images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, fileKey: true, sortOrder: true, isCover: true } } } });
  if (!place) notFound(); const images = orderedPlaceImages(place.images, place.imageUrls);
  if (place.createdById !== session.id) redirect(`/resident/places/${placeId}`);
  return <div className="mx-auto w-full max-w-3xl space-y-4"><Link href={`/resident/places/${place.id}`} className="inline-flex items-center gap-1.5 px-1 py-2 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />กลับรายละเอียดสถานที่</Link><div><h1 className="text-2xl font-bold text-gray-900">เสนอแก้ไขสถานที่</h1><p className="mt-1 text-sm text-gray-500">คำขอแก้ไขจะถูกส่งให้ผู้ดูแลหมู่บ้านพิจารณาก่อนอัปเดตข้อมูล</p></div><PlaceRequestForm mode="update" targetPlaceId={place.id} cancelHref={`/resident/places/${place.id}`} defaultValues={{ name: place.name, category: place.category, description: place.description ?? "", address: place.address ?? "", openingHours: place.openingHours ?? "", contactPhone: place.contactPhone ?? "", mapUrl: place.mapUrl ?? "", latitude: place.latitude == null ? "" : String(place.latitude), longitude: place.longitude == null ? "" : String(place.longitude), images }} /></div>;
}

import { notFound, redirect } from "next/navigation";
import { PlaceRequestForm } from "../../requests/request-form";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ placeId: string }>;
};

type PlaceEditItem = {
  id: string;
  villageId: string;
  name: string;
  category: string;
  description: string | null;
  address: string | null;
  openingHours: string | null;
  contactPhone: string | null;
  mapUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrls: unknown;
  isPublic: boolean;
};

type VillagePlaceDelegate = {
  findFirst(args: unknown): Promise<PlaceEditItem | null>;
};

export default async function ResidentPlaceRequestEditPage({ params }: PageProps) {
  const { placeId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/auth/login");

  const villagePlace = (prisma as unknown as { villagePlace: VillagePlaceDelegate }).villagePlace;
  const place = await villagePlace.findFirst({
    where: { id: placeId, villageId: membership.villageId },
    select: {
      id: true,
      villageId: true,
      name: true,
      category: true,
      description: true,
      address: true,
      openingHours: true,
      contactPhone: true,
      mapUrl: true,
      latitude: true,
      longitude: true,
      imageUrls: true,
      isPublic: true,
    },
  });

  if (!place) notFound();

  const imageUrls = Array.isArray(place.imageUrls)
    ? place.imageUrls.map((value) => String(value)).filter((url) => url.length > 0)
    : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ขอแก้ไขสถานที่</h1>
        <p className="mt-1 text-sm text-gray-500">คำขอแก้ไขจะถูกส่งให้แอดมินพิจารณาก่อนอัปเดตข้อมูล</p>
      </div>
      <PlaceRequestForm
        mode="update"
        targetPlaceId={place.id}
        defaultValues={{
          name: place.name,
          category: place.category,
          description: place.description ?? "",
          address: place.address ?? "",
          openingHours: place.openingHours ?? "",
          contactPhone: place.contactPhone ?? "",
          mapUrl: place.mapUrl ?? "",
          latitude: place.latitude == null ? "" : String(place.latitude),
          longitude: place.longitude == null ? "" : String(place.longitude),
          isPublic: place.isPublic,
          imageUrls,
        }}
      />
    </div>
  );
}

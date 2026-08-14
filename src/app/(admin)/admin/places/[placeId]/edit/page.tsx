import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { PlaceForm } from "../../place-form";
import { orderedPlaceImages, type PlaceImageView } from "@/lib/place-image";

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
  images: PlaceImageView[];
  isPublic: boolean;
  isFeatured: boolean;
};

type VillagePlaceEditDelegate = {
  findFirst(args: unknown): Promise<PlaceEditItem | null>;
};

export default async function AdminPlaceEditPage({ params }: PageProps) {
  const { placeId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const villagePlace = (prisma as unknown as { villagePlace: VillagePlaceEditDelegate }).villagePlace;
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
      images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, fileKey: true, sortOrder: true, isCover: true } },
      isPublic: true,
      isFeatured: true,
    },
  });

  if (!place) notFound();

  const images = orderedPlaceImages(place.images, place.imageUrls);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <Link href={`/admin/places/${place.id}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> กลับรายละเอียดสถานที่
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">แก้ไขสถานที่</h1>
        <p className="mt-1 text-sm text-gray-500">อัปเดตข้อมูลและรูปภาพสถานที่</p>
      </div>
      <PlaceForm
        mode="edit"
        placeId={place.id}
        cancelHref={`/admin/places/${place.id}`}
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
          isFeatured: place.isFeatured,
          images,
        }}
      />
    </div>
  );
}

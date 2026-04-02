import Link from "next/link";
import { ArrowLeft, Clock3, MapPin, Phone } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ImageCarousel } from "@/components/ui/image-carousel";
import { SaveButton } from "@/components/ui/save-button";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { VILLAGE_PLACE_CATEGORY_LABELS } from "@/lib/constants";
import { getVillagePlaceEmbedMapUrl } from "@/lib/village-place";
import { toggleSavePlaceAction } from "@/app/(resident)/resident/saved/actions";

type PageProps = {
  params: Promise<{ placeId: string }>;
};

type PlaceDetail = {
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

type VillagePlaceDetailDelegate = {
  findFirst(args: unknown): Promise<PlaceDetail | null>;
};

export default async function ResidentPlaceDetailPage({ params }: PageProps) {
  const { placeId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/auth/login");

  const villagePlace = (prisma as unknown as { villagePlace: VillagePlaceDetailDelegate }).villagePlace;
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

  const savedItemDelegate = (prisma as unknown as {
    savedItem: { findFirst(args: unknown): Promise<{ id: string } | null> };
  }).savedItem;

  const saved = await savedItemDelegate.findFirst({
    where: { userId: session.id, placeId: place.id },
    select: { id: true },
  });

  const imageUrls = Array.isArray(place.imageUrls)
    ? place.imageUrls.map((value) => String(value)).filter((url) => url.length > 0)
    : [];
  const embedMapUrl = getVillagePlaceEmbedMapUrl(place.latitude, place.longitude);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/resident/places" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> กลับรายการสถานที่
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <SaveButton
            itemId={place.id}
            initialSaved={Boolean(saved)}
            toggleAction={toggleSavePlaceAction}
            label="บันทึกสถานที่"
          />
          <Link href={`/resident/places/${place.id}/request-edit`} className="text-sm font-medium text-green-700 hover:text-green-800">
            ขอแก้ไขสถานที่
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{VILLAGE_PLACE_CATEGORY_LABELS[place.category] ?? place.category}</Badge>
          <Badge variant={place.isPublic ? "success" : "info"}>{place.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}</Badge>
        </div>

        <h1 className="mt-3 text-2xl font-bold text-gray-900">{place.name}</h1>

        {imageUrls.length > 0 && (
          <div className="mt-5">
            <ImageCarousel images={imageUrls} altPrefix={place.name} />
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
          {place.address && (
            <p className="inline-flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-gray-500" /> {place.address}
            </p>
          )}
          {place.openingHours && (
            <p className="inline-flex items-start gap-2">
              <Clock3 className="mt-0.5 h-4 w-4 text-gray-500" /> {place.openingHours}
            </p>
          )}
          {place.contactPhone && (
            <p className="inline-flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 text-gray-500" /> {place.contactPhone}
            </p>
          )}
          {place.latitude != null && place.longitude != null && (
            <p className="text-xs text-gray-500">พิกัด: {place.latitude}, {place.longitude}</p>
          )}
        </div>

        {place.description && (
          <div className="mt-6 border-t pt-6">
            <p className="whitespace-pre-wrap leading-7 text-gray-700">{place.description}</p>
          </div>
        )}

        {place.mapUrl && (
          <div className="mt-4">
            <a
              href={place.mapUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-green-700 hover:text-green-800"
            >
              เปิดแผนที่
            </a>
          </div>
        )}

        {embedMapUrl && (
          <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
            <iframe
              title={`map-${place.id}`}
              src={embedMapUrl}
              className="h-72 w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}
      </div>
    </div>
  );
}

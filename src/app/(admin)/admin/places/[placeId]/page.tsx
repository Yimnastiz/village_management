import Link from "next/link";
import { Clock3, MapPin, Pencil, Phone } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ImageCarousel } from "@/components/ui/image-carousel";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { VILLAGE_PLACE_CATEGORY_LABELS } from "@/lib/constants";
import { DeletePlaceButton } from "../delete-place-button";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { getVillagePlaceEmbedMapUrl } from "@/lib/village-place";
import { orderedPlaceImages, type PlaceImageView } from "@/lib/place-image";

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
  images: PlaceImageView[];
  createdAt: Date;
  createdBy: { name: string } | null;
  isPublic: boolean;
  isFeatured: boolean;
};

type VillagePlaceDetailDelegate = {
  findFirst(args: unknown): Promise<PlaceDetail | null>;
};

export default async function AdminPlaceDetailPage({ params }: PageProps) {
  const { placeId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const villagePlace = (prisma as unknown as { villagePlace: VillagePlaceDetailDelegate }).villagePlace;
  const place = await villagePlace.findFirst({
    where: {
      id: placeId,
      villageId: membership.villageId,
    },
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
      createdAt: true,
      createdBy: { select: { name: true } },
      isPublic: true,
      isFeatured: true,
    },
  });

  if (!place) notFound();

  const imageUrls = orderedPlaceImages(place.images, place.imageUrls).map((image) => image.url);
  const approvedCreate = await prisma.villagePlaceSubmission.findFirst({ where: { villageId: membership.villageId, approvedPlaceId: place.id, type: "CREATE", status: "APPROVED" }, orderBy: { reviewedAt: "asc" }, select: { requester: { select: { name: true } } } });
  const creatorName = approvedCreate?.requester.name ?? place.createdBy?.name;
  const creatorLabel = approvedCreate ? "เสนอโดย" : "เพิ่มโดย";
  const embedMapUrl = getVillagePlaceEmbedMapUrl(place.latitude, place.longitude);

  return (
    <div data-admin-compact-top className="mx-auto flex w-full max-w-4xl flex-col gap-3">
      <AdminPageToolbar
        variant="detail"
        backHref="/admin/places"
        backLabel="กลับรายการสถานที่"
        title="รายละเอียดสถานที่"
        description="ข้อมูลสถานที่และการแสดงผล"
        actions={<><Link href={`/admin/places/${place.id}/edit`} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"><Pencil className="mr-1 h-4 w-4" /> แก้ไข</Link><DeletePlaceButton placeId={place.id} placeName={place.name} /></>}
      />

      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-8">
        <div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{VILLAGE_PLACE_CATEGORY_LABELS[place.category] ?? place.category}</Badge>
              {place.isFeatured && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">สำคัญ</Badge>}
              <Badge variant={place.isPublic ? "success" : "info"}>{place.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}</Badge>
            </div>
            <h2 className="mt-3 text-xl font-bold text-gray-900">{place.name}</h2>
            {creatorName && <p className="mt-1 text-sm text-gray-500">{creatorLabel} {creatorName}</p>}
            <p className="mt-0.5 text-xs text-gray-400">{new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(place.createdAt)}</p>
          </div>
        </div>

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
              className="text-sm font-medium text-blue-700 hover:text-blue-800"
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

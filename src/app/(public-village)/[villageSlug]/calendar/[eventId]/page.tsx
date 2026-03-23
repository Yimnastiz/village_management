import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { normalizeVillageSlugParam } from "@/lib/village-slug";

interface PageProps {
  params: Promise<{ villageSlug: string; eventId: string }>;
}

export default async function PublicVillageEventDetailPage({ params }: PageProps) {
  const { villageSlug: rawVillageSlug, eventId } = await params;
  const villageSlug = normalizeVillageSlugParam(rawVillageSlug);

  const village = await prisma.village.findUnique({
    where: { slug: villageSlug },
    select: { id: true, slug: true, name: true },
  });
  if (!village) notFound();

  const event = await prisma.villageEvent.findFirst({
    where: {
      id: eventId,
      villageId: village.id,
      isPublic: true,
    },
  });
  if (!event) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href={`/${village.slug}/calendar`}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> กลับปฏิทินกิจกรรม
      </Link>

      <article className="rounded-xl border border-gray-200 bg-white p-8 space-y-5">
        <div className="flex items-center gap-2">
          <Badge variant="success">กิจกรรมสาธารณะ</Badge>
          <Badge variant="outline">{village.name}</Badge>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">วันเวลาเริ่ม</p>
            <p className="text-gray-900 mt-1">{event.startsAt.toLocaleString("th-TH")}</p>
          </div>
          <div>
            <p className="text-gray-500">วันเวลาสิ้นสุด</p>
            <p className="text-gray-900 mt-1">
              {event.endsAt ? event.endsAt.toLocaleString("th-TH") : "ไม่ระบุ"}
            </p>
          </div>
          <div>
            <p className="text-gray-500">สถานที่</p>
            <p className="text-gray-900 mt-1">{event.location || "ไม่ระบุ"}</p>
          </div>
        </div>

        {event.description && (
          <div className="pt-2 border-t border-gray-100">
            <p className="whitespace-pre-wrap leading-7 text-gray-700">{event.description}</p>
          </div>
        )}
      </article>
    </div>
  );
}

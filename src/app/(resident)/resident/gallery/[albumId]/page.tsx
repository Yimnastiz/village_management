import Link from "next/link";
import { ArrowLeft, ImagePlus } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { AlbumGalleryViewer } from "./album-gallery-viewer";

const db = prisma as any;

type ResidentAlbumDetailPageProps = {
  params: Promise<{ albumId: string }>;
  searchParams?: Promise<{ submitted?: string }>;
};

export default async function ResidentAlbumDetailPage({ params, searchParams }: ResidentAlbumDetailPageProps) {
  const { albumId } = await params;
  const query = (searchParams ? await searchParams : {}) ?? {};

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/auth/login");

  const album = await db.galleryAlbum.findFirst({
    where: {
      id: albumId,
      villageId: membership.villageId,
    },
    include: {
      items: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          fileUrl: true,
        },
      },
    },
  });

  if (!album) notFound();

  const myRecentSubmissions = await db.galleryItemSubmission.findMany({
    where: {
      albumId: album.id,
      requesterId: session.id,
    },
    orderBy: [{ createdAt: "desc" }],
    take: 5,
    select: {
      id: true,
      status: true,
      title: true,
      reviewNote: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/resident/gallery" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> กลับหน้าแกลเลอรี
        </Link>

        {album.allowResidentSubmissions && (
          <Link href={`/resident/gallery/${album.id}/request`}>
            <Button size="sm">
              <ImagePlus className="mr-1 h-4 w-4" /> ขอเพิ่มรูปในอัลบั้ม
            </Button>
          </Link>
        )}
      </div>

      <article className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={album.isPublic ? "success" : "info"}>{album.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}</Badge>
          <Badge variant={album.allowResidentSubmissions ? "warning" : "default"}>
            {album.allowResidentSubmissions ? "อัลบั้มนี้เปิดรับคำขอเพิ่มรูป" : "อัลบั้มนี้ไม่เปิดรับคำขอเพิ่มรูป"}
          </Badge>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">{album.title}</h1>
        {album.description && <p className="text-sm text-gray-600">{album.description}</p>}

        {query.submitted === "1" && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            ส่งคำขอเพิ่มรูปเรียบร้อยแล้ว รอแอดมินอนุมัติ
          </div>
        )}

        <AlbumGalleryViewer items={album.items} />
      </article>

      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">คำขอเพิ่มรูปของฉัน</h2>
          <Badge variant="outline">{myRecentSubmissions.length} รายการล่าสุด</Badge>
        </div>

        {myRecentSubmissions.length === 0 ? (
          <p className="text-sm text-gray-500">ยังไม่มีคำขอในอัลบั้มนี้</p>
        ) : (
          <div className="space-y-2">
            {myRecentSubmissions.map((submission: any) => (
              <div key={submission.id} className="rounded-lg border border-gray-200 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-gray-900">{submission.title || "(ไม่มีหัวข้อรูปภาพ)"}</p>
                  <Badge
                    variant={
                      submission.status === "APPROVED"
                        ? "success"
                        : submission.status === "REJECTED"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {submission.status === "APPROVED"
                      ? "อนุมัติแล้ว"
                      : submission.status === "REJECTED"
                        ? "ไม่อนุมัติ"
                        : "รออนุมัติ"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-gray-500">ส่งเมื่อ {submission.createdAt.toLocaleString("th-TH")}</p>
                {submission.reviewNote && <p className="mt-2 text-sm text-gray-600">หมายเหตุ: {submission.reviewNote}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

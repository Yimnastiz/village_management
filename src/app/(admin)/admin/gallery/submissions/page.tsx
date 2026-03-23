import Link from "next/link";
import { ImagePlus } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

type AdminGallerySubmissionsPageProps = {
  searchParams?: Promise<{ albumId?: string }>;
};

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

const statusLabel: Record<string, string> = {
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
};

export default async function AdminGallerySubmissionsPage({ searchParams }: AdminGallerySubmissionsPageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const submissions = await db.galleryItemSubmission.findMany({
    where: {
      album: {
        villageId: membership.villageId,
      },
      ...(params.albumId ? { albumId: params.albumId } : {}),
    },
    include: {
      album: { select: { id: true, title: true } },
      requester: { select: { id: true, name: true, phoneNumber: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">คำขอเพิ่มรูปในอัลบั้ม</h1>
          <p className="mt-1 text-sm text-gray-500">ตรวจสอบและอนุมัติรูปที่ลูกบ้านร้องขอ</p>
        </div>
        <Link href="/admin/gallery" className="text-sm text-gray-600 hover:text-gray-900 hover:underline">
          กลับไปหน้าแกลเลอรี
        </Link>
      </div>

      {submissions.length === 0 ? (
        <EmptyState icon={ImagePlus} title="ยังไม่มีคำขอเพิ่มรูป" description="เมื่อมีลูกบ้านส่งคำขอจะปรากฏที่หน้านี้" />
      ) : (
        <div className="space-y-3">
          {submissions.map((submission: any) => (
            <Link
              key={submission.id}
              href={`/admin/gallery/submissions/${submission.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant={statusVariant[submission.status] ?? "default"}>
                      {statusLabel[submission.status]}
                    </Badge>
                    <Badge variant="outline">{submission.album.title}</Badge>
                  </div>
                  <p className="font-medium text-gray-900">{submission.title || "(ไม่มีหัวข้อรูปภาพ)"}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    ผู้ส่งคำขอ: {submission.requester.name} ({submission.requester.phoneNumber})
                  </p>
                </div>
                <p className="whitespace-nowrap text-xs text-gray-400">
                  {submission.createdAt.toLocaleDateString("th-TH")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

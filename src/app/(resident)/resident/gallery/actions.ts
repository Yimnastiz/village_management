"use server";

import { randomUUID } from "node:crypto";
import { NotificationType, VillageMembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { revalidateAdminSidebar } from "@/lib/revalidate-admin-sidebar";
import { adminRequestCopy, notificationMetadata } from "@/lib/notification-copy";
import { verifyPlaceUploadToken } from "@/lib/place-upload.server";

const item = z.object({
  fileKey: z.string().trim().min(1),
  uploadToken: z.string().trim().min(1),
  url: z.string().trim().min(1),
  title: z.string().trim().max(500, "คำอธิบายรูปภาพยาวเกินไป").optional(),
});
const schema = z.object({ note: z.string().trim().max(500).optional(), items: z.array(item).min(1, "กรุณาเพิ่มรูปภาพ").max(10, "เพิ่มรูปภาพได้สูงสุด 10 รูปต่อครั้ง") });
type SubmissionInput = z.infer<typeof schema>;

function galleryUploadUrl(fileKey: string) { return `/api/places/images?key=${encodeURIComponent(fileKey)}`; }
function revalidate(albumId: string, ids: string[]) {
  revalidateAdminSidebar();
  ["/resident/gallery", "/resident/gallery/requests", `/resident/gallery/${albumId}`, `/resident/gallery/${albumId}/request`, "/resident/notifications", "/admin/notifications", "/admin/gallery/submissions"].forEach((path) => revalidatePath(path));
  ids.forEach((id) => revalidatePath(`/admin/gallery/submissions/${id}`));
}

export async function createGalleryItemSubmissionAction(albumId: string, data: SubmissionInput): Promise<{ success: true; ids: string[]; batchId: string } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบ" };
  const membership = getResidentMembership(session);
  if (!membership) return { success: false, error: "ไม่พบสิทธิ์ลูกบ้าน" };
  const parsed = schema.safeParse(data);
  if (!parsed.success) return { success: false, error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง" };
  if (!parsed.data.items.every((entry) => entry.url === galleryUploadUrl(entry.fileKey) && verifyPlaceUploadToken(entry.uploadToken, entry.fileKey, membership.villageId, session.id))) return { success: false, error: "ข้อมูลรูปภาพไม่ถูกต้อง กรุณาอัปโหลดใหม่อีกครั้ง" };

  // The authorization check stays on the mutation: a direct request cannot bypass a closed album.
  const album = await prisma.galleryAlbum.findFirst({ where: { id: albumId, villageId: membership.villageId, allowResidentSubmissions: true }, select: { id: true, title: true } });
  if (!album) return { success: false, error: "อัลบั้มนี้ไม่เปิดรับคำขอ" };

  const batchId = randomUUID();
  const created = await prisma.$transaction((tx) => tx.galleryItemSubmission.createManyAndReturn({
    data: parsed.data.items.map((entry, batchOrder) => ({ albumId: album.id, requesterId: session.id, batchId, batchOrder, title: entry.title?.trim() || null, fileUrl: entry.url, fileKey: entry.fileKey, mimeType: null, note: parsed.data.note?.trim() || null })),
    select: { id: true },
  }));
  const admins = await prisma.villageMembership.findMany({ where: { villageId: membership.villageId, status: "ACTIVE", role: { in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN] } }, select: { userId: true }, distinct: ["userId"] });
  if (admins.length) { const copy = adminRequestCopy({ source: "GALLERY", requestType: "CREATE", entityName: album.title, requesterName: session.name }); await prisma.notification.createMany({ data: admins.map((admin) => ({ userId: admin.userId, villageId: membership.villageId, type: NotificationType.SYSTEM, title: copy.title, body: `${copy.body} (${created.length} รูป)`, metadata: notificationMetadata("GALLERY", { actionUrl: `/admin/gallery/submissions?batchId=${encodeURIComponent(batchId)}`, actionLabel: "ตรวจสอบคำขอ", batchId, albumId: album.id, submissionCount: created.length }) })) }); }
  revalidate(album.id, created.map((entry) => entry.id));
  return { success: true, ids: created.map((entry) => entry.id), batchId };
}

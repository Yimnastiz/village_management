"use server";
import { NotificationType, VillageMembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { hasSafeTotalImageDataSize, isSafeImageSource } from "@/lib/image-input";
const item = z.object({ fileUrl: z.string().trim().min(1), title: z.string().trim().max(500, "คำอธิบายรูปภาพยาวเกินไป").optional() });
const schema = z.object({ note: z.string().trim().max(500).optional(), items: z.array(item).min(1, "กรุณาเพิ่มรูปภาพ").max(10, "เพิ่มรูปภาพได้สูงสุด 10 รูปต่อครั้ง") });
type SubmissionInput = z.infer<typeof schema>;
function revalidate(albumId: string, ids: string[]) { ["/resident/gallery", `/resident/gallery/${albumId}`, `/resident/gallery/${albumId}/request`, "/resident/notifications", "/admin/notifications", "/admin/gallery/submissions"].forEach((path) => revalidatePath(path)); ids.forEach((id) => revalidatePath(`/admin/gallery/submissions/${id}`)); }
export async function createGalleryItemSubmissionAction(albumId: string, data: SubmissionInput): Promise<{ success: true; ids: string[] } | { success: false; error: string }> {
 const session = await getSessionContextFromServerCookies(); if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบ" };
 const membership = getResidentMembership(session); if (!membership) return { success: false, error: "ไม่พบสิทธิ์ลูกบ้าน" };
 const parsed = schema.safeParse(data); if (!parsed.success) return { success: false, error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง" };
 const urls = parsed.data.items.map((entry) => entry.fileUrl); if (!urls.every(isSafeImageSource) || !hasSafeTotalImageDataSize(urls)) return { success: false, error: "รูปภาพไม่ถูกต้องหรือขนาดรวมเกินกำหนด" };
 const album = await prisma.galleryAlbum.findFirst({ where: { id: albumId, villageId: membership.villageId, allowResidentSubmissions: true }, select: { id: true, title: true } }); if (!album) return { success: false, error: "ไม่พบอัลบั้มหรืออัลบั้มนี้ไม่เปิดรับคำขอ" };
 const created = await prisma.$transaction(async (tx) => tx.galleryItemSubmission.createManyAndReturn({ data: parsed.data.items.map((entry, index) => ({ albumId: album.id, requesterId: session.id, title: entry.title?.trim() || null, fileUrl: urls[index], mimeType: /^data:(image\/[^;]+)/.exec(urls[index])?.[1] ?? null, note: parsed.data.note?.trim() || null })), select: { id: true } }));
 const admins = await prisma.villageMembership.findMany({ where: { villageId: membership.villageId, status: "ACTIVE", role: { in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN, VillageMembershipRole.COMMITTEE] } }, select: { userId: true }, distinct: ["userId"] });
 if (admins.length) await prisma.notification.createMany({ data: admins.map((admin) => ({ userId: admin.userId, villageId: membership.villageId, type: NotificationType.SYSTEM, title: "มีคำขอเพิ่มรูปภาพใหม่", body: `${session.name} ส่งรูป ${created.length} รูปไปยังอัลบั้ม ${album.title}`, metadata: { actionUrl: `/admin/gallery/submissions/${created[0].id}`, actionLabel: "ตรวจสอบคำขอ", submissionId: created[0].id, albumId: album.id } })) });
 revalidate(album.id, created.map((entry) => entry.id)); return { success: true, ids: created.map((entry) => entry.id) };
}

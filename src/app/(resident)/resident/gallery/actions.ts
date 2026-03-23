"use server";

import { NotificationType, VillageMembershipRole } from "@prisma/client";
import { z } from "zod";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

const submissionSchema = z.object({
  title: z.string().trim().min(2, "กรุณาระบุหัวข้อรูปภาพ").max(120),
  fileUrl: z.string().trim().url("URL รูปภาพไม่ถูกต้อง"),
  mimeType: z.string().trim().optional(),
  note: z.string().trim().max(500, "ข้อความประกอบยาวเกินไป").optional(),
});

type SubmissionInput = z.infer<typeof submissionSchema>;

export async function createGalleryItemSubmissionAction(
  albumId: string,
  data: SubmissionInput
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    return { success: false, error: "กรุณาเข้าสู่ระบบ" };
  }

  const membership = getResidentMembership(session);
  if (!membership) {
    return { success: false, error: "ไม่พบหมู่บ้านของคุณ" };
  }

  const parsed = submissionSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง",
    };
  }

  const album = await db.galleryAlbum.findFirst({
    where: {
      id: albumId,
      villageId: membership.villageId,
    },
    select: {
      id: true,
      title: true,
      allowResidentSubmissions: true,
    },
  });

  if (!album) {
    return { success: false, error: "ไม่พบอัลบั้มนี้" };
  }

  if (!album.allowResidentSubmissions) {
    return { success: false, error: "อัลบั้มนี้ไม่ได้เปิดให้ลูกบ้านส่งคำขอเพิ่มรูป" };
  }

  const created = await db.galleryItemSubmission.create({
    data: {
      albumId: album.id,
      requesterId: session.id,
      title: parsed.data.title,
      fileUrl: parsed.data.fileUrl,
      mimeType: parsed.data.mimeType?.trim() || null,
      note: parsed.data.note?.trim() || null,
    },
    select: {
      id: true,
    },
  });

  const adminUsers = await prisma.villageMembership.findMany({
    where: {
      villageId: membership.villageId,
      status: "ACTIVE",
      role: {
        in: [
          VillageMembershipRole.HEADMAN,
          VillageMembershipRole.ASSISTANT_HEADMAN,
          VillageMembershipRole.COMMITTEE,
        ],
      },
    },
    select: {
      userId: true,
    },
    distinct: ["userId"],
  });

  if (adminUsers.length > 0) {
    await prisma.notification.createMany({
      data: adminUsers.map((admin) => ({
        userId: admin.userId,
        villageId: membership.villageId,
        type: NotificationType.SYSTEM,
        title: "มีคำขอเพิ่มรูปภาพใหม่",
        body: `${session.name} ส่งคำขอเพิ่มรูปไปยังอัลบั้ม ${album.title}`,
        metadata: {
          actionUrl: `/admin/gallery/submissions/${created.id}`,
          actionLabel: "ตรวจสอบคำขอ",
          submissionId: created.id,
          albumId: album.id,
        },
      })),
    });
  }

  return { success: true, id: created.id };
}

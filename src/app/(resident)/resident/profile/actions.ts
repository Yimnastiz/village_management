"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { isSafeImageSource } from "@/lib/image-input";

const profileSchema = z.object({
  displayName: z.string().trim().min(2, "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร").max(80),
  email: z.union([z.literal(""), z.string().trim().email("รูปแบบอีเมลไม่ถูกต้อง")]).transform((value) => value || null),
  image: z.string().nullable().transform((value) => {
    if (!value?.trim()) return null;
    return isSafeImageSource(value) ? value.trim() : null;
  }),
});

export async function updateProfileAction(data: { displayName: string; email: string; image: string | null }): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบ" };

  const parsed = profileSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  const { displayName, email, image } = parsed.data;
  if (data.image?.trim() && !image) return { success: false, error: "รูปโปรไฟล์ไม่ถูกต้อง" };
  if (email) {
    const conflict = await prisma.user.findFirst({ where: { email, id: { not: session.id } }, select: { id: true } });
    if (conflict) return { success: false, error: "อีเมลนี้ถูกใช้งานแล้ว" };
  }

  await prisma.user.update({
    where: { id: session.id },
    data: { name: displayName, email, image, ...(email !== data.email.trim() ? { emailVerified: false } : {}) },
  });

  revalidatePath("/resident/profile");
  revalidatePath("/resident", "layout");
  return { success: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { isSafeImageSource } from "@/lib/image-input";
import { normalizePhone10 } from "@/lib/registration-temp";

const profileSchema = z.object({
  phoneNumber: z.string().trim().min(1),
  email: z.union([z.literal(""), z.string().trim().email("รูปแบบอีเมลไม่ถูกต้อง")]).transform((value) => value || null),
  image: z.string().nullable().transform((value) => {
    if (!value?.trim()) return null;
    return isSafeImageSource(value) ? value.trim() : null;
  }),
});

export async function updateProfileAction(data: { phoneNumber: string; email: string; image: string | null }): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบ" };

  const parsed = profileSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  const { email, image } = parsed.data;
  const phoneNumber = normalizePhone10(parsed.data.phoneNumber);
  if (!phoneNumber) return { success: false, error: "กรุณากรอกเบอร์โทรศัพท์ 10 หลัก" };
  if (data.image?.trim() && !image) return { success: false, error: "รูปโปรไฟล์ไม่ถูกต้อง" };
  const phoneConflict = await prisma.user.findFirst({ where: { phoneNumber, id: { not: session.id }, accountStatus: "ACTIVE" }, select: { id: true } });
  if (phoneConflict) return { success: false, error: "เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว" };
  if (email) {
    const conflict = await prisma.user.findFirst({ where: { email, id: { not: session.id } }, select: { id: true } });
    if (conflict) return { success: false, error: "อีเมลนี้ถูกใช้งานแล้ว" };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.id },
      data: { phoneNumber, email, image, ...(phoneNumber !== data.phoneNumber.trim() ? { phoneNumberVerified: false } : {}), ...(email !== data.email.trim() ? { emailVerified: false } : {}) },
    }),
    prisma.person.updateMany({ where: { userId: session.id }, data: { phone: phoneNumber, email } }),
  ]);

  revalidatePath("/resident/profile");
  revalidatePath("/resident", "layout");
  return { success: true };
}

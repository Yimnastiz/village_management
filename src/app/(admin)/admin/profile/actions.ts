"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { isSafeImageSource } from "@/lib/image-input";
import { prisma } from "@/lib/prisma";
import { normalizePhone10 } from "@/lib/registration-temp";

const profileSchema = z.object({ phoneNumber: z.string().trim().min(1), email: z.union([z.literal(""), z.string().trim().email("รูปแบบอีเมลไม่ถูกต้อง")]).transform((email) => email || null), image: z.string().nullable().transform((image) => !image?.trim() ? null : isSafeImageSource(image) ? image.trim() : null) });
async function currentAdmin() { const session = await getSessionContextFromServerCookies(); return session && getAdminMembership(session) ? session : null; }

export async function updateAdminProfileAction(data: { phoneNumber: string; email: string; image: string | null }): Promise<{ success: true } | { success: false; error: string }> {
  const session = await currentAdmin(); if (!session) return { success: false, error: "ไม่พบสิทธิ์ใช้งาน" };
  const parsed = profileSchema.safeParse(data); if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const phoneNumber = normalizePhone10(parsed.data.phoneNumber); if (!phoneNumber) return { success: false, error: "กรุณากรอกเบอร์โทรศัพท์ 10 หลัก" };
  if (data.image?.trim() && !parsed.data.image) return { success: false, error: "รูปโปรไฟล์ไม่ถูกต้อง" };
  const email = parsed.data.email;
  const [phoneConflict, emailConflict, current] = await Promise.all([prisma.user.findFirst({ where: { phoneNumber, id: { not: session.id }, accountStatus: "ACTIVE" }, select: { id: true } }), email ? prisma.user.findFirst({ where: { email, id: { not: session.id } }, select: { id: true } }) : null, prisma.user.findUniqueOrThrow({ where: { id: session.id }, select: { phoneNumber: true, email: true } })]);
  if (phoneConflict) return { success: false, error: "เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว" }; if (emailConflict) return { success: false, error: "อีเมลนี้ถูกใช้งานแล้ว" };
  await prisma.$transaction([prisma.user.update({ where: { id: session.id }, data: { phoneNumber, email, image: parsed.data.image, ...(phoneNumber !== current.phoneNumber ? { phoneNumberVerified: false } : {}), ...(email !== current.email ? { emailVerified: false } : {}) } }), prisma.person.updateMany({ where: { userId: session.id }, data: { phone: phoneNumber, email } })]);
  revalidatePath("/admin/profile"); revalidatePath("/admin", "layout"); return { success: true };
}
export async function revealOwnAdminNationalIdAction(): Promise<{ success: true; nationalId: string } | { success: false }> { const session = await currentAdmin(); if (!session) return { success: false }; const person = await prisma.person.findUnique({ where: { userId: session.id }, select: { nationalId: true } }); return person?.nationalId ? { success: true, nationalId: person.nationalId } : { success: false }; }

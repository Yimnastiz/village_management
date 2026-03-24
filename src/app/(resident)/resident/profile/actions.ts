"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies } from "@/lib/access-control";

const profileSchema = z.object({
  name: z.string().trim().min(2, "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร").max(120),
  email: z
    .union([z.literal(""), z.string().trim().email("รูปแบบอีเมลไม่ถูกต้อง")])
    .transform((v) => (v === "" ? null : v)),
  image: z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      if (!v || v.trim() === "") return null;
      const t = v.trim();
      if (t.startsWith("data:image/") || t.startsWith("https://") || t.startsWith("http://")) return t;
      return null;
    }),
});

export async function updateProfileAction(data: {
  name: string;
  email: string;
  image: string | null;
}): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบ" };

  const parsed = profileSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  const { name, email, image } = parsed.data;

  if (email) {
    const conflict = await prisma.user.findFirst({
      where: { email, id: { not: session.id } },
      select: { id: true },
    });
    if (conflict) return { success: false, error: "อีเมลนี้ถูกใช้งานแล้ว" };
  }

  await prisma.user.update({
    where: { id: session.id },
    data: { name, email, image },
  });

  revalidatePath("/resident/profile");
  revalidatePath("/resident", "layout");
  return { success: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies } from "@/lib/access-control";

const profileSchema = z.object({
  // User.name is the existing display-name field. Legal identity data stays in Person.
  displayName: z.string().trim().min(2, "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร").max(80),
});

export async function updateProfileAction(data: { displayName: string }): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบ" };

  const parsed = profileSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  await prisma.user.update({
    where: { id: session.id },
    data: { name: parsed.data.displayName },
  });

  revalidatePath("/resident/profile");
  revalidatePath("/resident", "layout");
  return { success: true };
}

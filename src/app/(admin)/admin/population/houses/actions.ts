"use server";

import { MembershipStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { canManagePopulation, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { createVillageHouse, deleteVillageHouse, PopulationValidationError } from "@/features/population/server/village-population-service";

export type HouseActionResult =
  | { success: true; id: string; message: string }
  | { success: false; error: string; field?: "houseNumber" | "address" };

async function getPopulationContext() {
  const session = await getSessionContextFromServerCookies();
  if (!session || !isAdminUser(session)) return null;
  const membership = session.memberships.find((item) => item.status === MembershipStatus.ACTIVE && canManagePopulation(item.role));
  return membership ? { villageId: membership.villageId, actor: { id: session.id, role: "ADMIN" as const } } : null;
}

export async function createHouseAction(formData: FormData): Promise<HouseActionResult> {
  const context = await getPopulationContext();
  if (!context) return { success: false, error: "คุณไม่มีสิทธิ์เพิ่มบ้าน" };

  try {
    const house = await createVillageHouse(context.villageId, {
      houseNumber: String(formData.get("houseNumber") ?? ""),
      address: String(formData.get("address") ?? ""),
    }, context.actor);
    revalidatePath("/admin/population");
    revalidatePath("/admin/population/houses");
    return { success: true, id: house.id, message: "เพิ่มบ้านเรียบร้อยแล้ว" };
  } catch (error) {
    if (error instanceof PopulationValidationError) {
      return { success: false, error: error.message, field: "houseNumber" };
    }
    console.error("[population] create house failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return { success: false, error: "ไม่สามารถเพิ่มบ้านได้ กรุณาลองใหม่อีกครั้ง" };
  }
}

export async function deleteHouseAction(houseId: string, reason: string): Promise<{ success: true } | { success: false; error: string }> {
  const context = await getPopulationContext();
  if (!context) return { success: false, error: "คุณไม่มีสิทธิ์ลบบ้าน" };
  try {
    await deleteVillageHouse(context.villageId, houseId, reason, context.actor);
    revalidatePath("/admin/population");
    revalidatePath("/admin/population/houses");
    return { success: true };
  } catch (error) {
    if (error instanceof PopulationValidationError) return { success: false, error: error.message };
    console.error("[population] delete house failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return { success: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" };
  }
}

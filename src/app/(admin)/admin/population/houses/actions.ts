"use server";

import { revalidatePath } from "next/cache";
import { getVillagePermissionContext } from "@/lib/admin-permission.server";
import { createVillageHouse, createVillageHouses, deleteVillageHouse, PopulationBatchValidationError, PopulationValidationError } from "@/features/population/server/village-population-service";

export type HouseActionResult =
  | { success: true; id: string; message: string }
  | { success: false; error: string; field?: "houseNumber" | "address" };
export type HouseBatchActionResult = { success: true; count: number; message: string } | { success: false; error?: string; errors?: Array<{ index: number; field: "houseNumber" | "address"; message: string }> };

async function getPopulationContext() {
  const context = await getVillagePermissionContext("population.house.manage");
  return context ? { villageId: context.villageId, actor: { id: context.session.id, role: context.membership.role as "HEADMAN" | "ASSISTANT_HEADMAN" } } : null;
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

export async function createHousesAction(items: Array<{ houseNumber: string; address?: string }>, _reason?: string): Promise<HouseBatchActionResult> {
  const context = await getPopulationContext();
  if (!context) return { success: false, error: "คุณไม่มีสิทธิ์เพิ่มบ้าน" };
  try {
    const houses = await createVillageHouses(context.villageId, items, context.actor);
    revalidatePath("/admin/population");
    revalidatePath("/admin/population/houses");
    return { success: true, count: houses.length, message: houses.length === 1 ? "เพิ่มบ้านเรียบร้อยแล้ว" : `เพิ่มบ้าน ${houses.length} หลังเรียบร้อยแล้ว` };
  } catch (error) {
    if (error instanceof PopulationBatchValidationError) return { success: false, errors: error.errors };
    console.error("[population] create houses failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
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

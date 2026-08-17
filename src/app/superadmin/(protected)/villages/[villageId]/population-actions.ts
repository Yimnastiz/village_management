"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminActionSession } from "@/lib/superadmin";
import {
  createVillageHouse,
  createVillageHouses,
  createVillagePerson,
  moveOutVillagePerson,
  PopulationBatchValidationError,
  PopulationValidationError,
  updateVillageHouse,
  updateVillagePerson,
  type VillagePersonInput,
} from "@/features/population/server/village-population-service";

export type PopulationActionResult = { success: true; id?: string; message: string } | { success: false; error: string };

function message(error: unknown) {
  if (error instanceof PopulationValidationError) return error.message;
  console.error(error);
  return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}

function refresh(villageId: string, resource: "houses" | "people", id?: string) {
  const base = `/superadmin/villages/${villageId}/${resource}`;
  revalidatePath(base);
  if (id) revalidatePath(`${base}/${id}`);
  revalidatePath(`/superadmin/villages/${villageId}/overview`);
  revalidatePath(`/superadmin/villages/${villageId}/audit`);
}

export async function createSuperAdminHouseAction(villageId: string, formData: FormData): Promise<PopulationActionResult> {
  const actor = await requireSuperAdminActionSession();
  try {
    const row = await createVillageHouse(villageId, { houseNumber: String(formData.get("houseNumber") ?? ""), address: String(formData.get("address") ?? ""), sourceNote: String(formData.get("reason") ?? "") }, { id: null, role: "SUPERADMIN" });
    refresh(villageId, "houses", row.id);
    return { success: true, id: row.id, message: "เพิ่มบ้านสำเร็จ" };
  } catch (error) { return { success: false, error: message(error) }; }
}

export async function createSuperAdminHousesAction(villageId: string, items: Array<{ houseNumber: string; address?: string }>, reason?: string): Promise<
  { success: true; count: number; message: string } | { success: false; error?: string; errors?: Array<{ index: number; field: "houseNumber" | "address"; message: string }> }
> {
  await requireSuperAdminActionSession();
  const normalizedReason = typeof reason === "string" ? reason.trim() : "";
  if (normalizedReason.length < 5) return { success: false, error: "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร" };
  try {
    const houses = await createVillageHouses(villageId, items, { id: null, role: "SUPERADMIN" }, { reason: normalizedReason });
    refresh(villageId, "houses");
    return { success: true, count: houses.length, message: houses.length === 1 ? "เพิ่มบ้านเรียบร้อยแล้ว" : `เพิ่มบ้าน ${houses.length} หลังเรียบร้อยแล้ว` };
  } catch (error) {
    if (error instanceof PopulationValidationError) return { success: false, error: error.message };
    if (error instanceof PopulationBatchValidationError) return { success: false, errors: error.errors };
    console.error("[superadmin] create houses failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return { success: false, error: "ไม่สามารถเพิ่มบ้านได้ กรุณาลองใหม่อีกครั้ง" };
  }
}

export async function updateSuperAdminHouseAction(villageId: string, houseId: string, formData: FormData): Promise<PopulationActionResult> {
  const actor = await requireSuperAdminActionSession();
  try {
    const result = await updateVillageHouse(villageId, houseId, { houseNumber: String(formData.get("houseNumber") ?? ""), address: String(formData.get("address") ?? ""), sourceNote: String(formData.get("reason") ?? "") }, { id: null, role: "SUPERADMIN" });
    refresh(villageId, "houses", houseId);
    return { success: true, message: result.statusChanged ? "เปลี่ยนสถานะบ้านสำเร็จ" : "แก้ไขบ้านสำเร็จ" };
  } catch (error) { return { success: false, error: message(error) }; }
}

export async function createSuperAdminPersonAction(villageId: string, data: VillagePersonInput): Promise<PopulationActionResult> {
  const actor = await requireSuperAdminActionSession();
  try {
    const row = await createVillagePerson(villageId, data, { id: null, role: "SUPERADMIN" });
    refresh(villageId, "people", row.id);
    return { success: true, id: row.id, message: "เพิ่มประชากรสำเร็จ" };
  } catch (error) { return { success: false, error: message(error) }; }
}

export async function updateSuperAdminPersonAction(villageId: string, personId: string, data: VillagePersonInput): Promise<PopulationActionResult> {
  const actor = await requireSuperAdminActionSession();
  try {
    const result = await updateVillagePerson(villageId, personId, data, { id: null, role: "SUPERADMIN" });
    refresh(villageId, "people", personId);
    return { success: true, message: result.moved ? "ย้ายบ้านสำเร็จ" : "แก้ไขข้อมูลประชากรสำเร็จ" };
  } catch (error) { return { success: false, error: message(error) }; }
}

export async function moveOutSuperAdminPersonAction(villageId: string, personId: string, reason: string): Promise<PopulationActionResult> {
  const actor = await requireSuperAdminActionSession();
  try {
    await moveOutVillagePerson(villageId, personId, reason, { id: null, role: "SUPERADMIN" });
    refresh(villageId, "people", personId);
    return { success: true, message: "ยกเลิกข้อมูลประชากรสำเร็จ" };
  } catch (error) { return { success: false, error: message(error) }; }
}

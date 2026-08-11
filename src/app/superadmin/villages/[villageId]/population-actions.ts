"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminActionSession } from "@/lib/superadmin";
import {
  createVillageHouse,
  createVillagePerson,
  deactivateVillagePerson,
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
    const row = await createVillageHouse(villageId, { houseNumber: String(formData.get("houseNumber") ?? ""), address: String(formData.get("address") ?? ""), sourceNote: String(formData.get("reason") ?? "") }, { id: actor.id, role: "SUPERADMIN" });
    refresh(villageId, "houses", row.id);
    return { success: true, id: row.id, message: "เพิ่มบ้านสำเร็จ" };
  } catch (error) { return { success: false, error: message(error) }; }
}

export async function updateSuperAdminHouseAction(villageId: string, houseId: string, formData: FormData): Promise<PopulationActionResult> {
  const actor = await requireSuperAdminActionSession();
  try {
    const result = await updateVillageHouse(villageId, houseId, { houseNumber: String(formData.get("houseNumber") ?? ""), address: String(formData.get("address") ?? ""), sourceNote: String(formData.get("reason") ?? "") }, { id: actor.id, role: "SUPERADMIN" });
    refresh(villageId, "houses", houseId);
    return { success: true, message: result.statusChanged ? "เปลี่ยนสถานะบ้านสำเร็จ" : "แก้ไขบ้านสำเร็จ" };
  } catch (error) { return { success: false, error: message(error) }; }
}

export async function createSuperAdminPersonAction(villageId: string, data: VillagePersonInput): Promise<PopulationActionResult> {
  const actor = await requireSuperAdminActionSession();
  try {
    const row = await createVillagePerson(villageId, data, { id: actor.id, role: "SUPERADMIN" });
    refresh(villageId, "people", row.id);
    return { success: true, id: row.id, message: "เพิ่มประชากรสำเร็จ" };
  } catch (error) { return { success: false, error: message(error) }; }
}

export async function updateSuperAdminPersonAction(villageId: string, personId: string, data: VillagePersonInput): Promise<PopulationActionResult> {
  const actor = await requireSuperAdminActionSession();
  try {
    const result = await updateVillagePerson(villageId, personId, data, { id: actor.id, role: "SUPERADMIN" });
    refresh(villageId, "people", personId);
    return { success: true, message: result.moved ? "ย้ายบ้านสำเร็จ" : "แก้ไขข้อมูลประชากรสำเร็จ" };
  } catch (error) { return { success: false, error: message(error) }; }
}

export async function deactivateSuperAdminPersonAction(villageId: string, personId: string, reason: string): Promise<PopulationActionResult> {
  const actor = await requireSuperAdminActionSession();
  try {
    await deactivateVillagePerson(villageId, personId, reason, { id: actor.id, role: "SUPERADMIN" });
    refresh(villageId, "people", personId);
    return { success: true, message: "ยกเลิกข้อมูลประชากรสำเร็จ" };
  } catch (error) { return { success: false, error: message(error) }; }
}

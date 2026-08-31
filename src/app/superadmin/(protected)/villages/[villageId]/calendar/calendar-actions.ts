"use server";

import { createEvent, deleteEvent, updateEvent, type EventInput } from "@/features/village-public-content/server/service";
import { requireSuperAdminVillageContext, requireSupportReason } from "@/features/village-public-content/server/context";

/** Calendar-specific Super Admin boundary. The route village is the only scope
 * accepted here; the shared service verifies ownership again for existing rows. */
async function contextFor(villageId: string, supportReason: string) {
  const context = await requireSuperAdminVillageContext(villageId);
  return { ...context, supportReason: requireSupportReason(supportReason) };
}

export async function createSuperAdminVillageEventAction(villageId: string, data: EventInput, supportReason: string) {
  try {
    return await createEvent(await contextFor(villageId, supportReason), data);
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "ไม่สามารถสร้างกิจกรรมได้" };
  }
}

export async function updateSuperAdminVillageEventAction(villageId: string, eventId: string, data: EventInput, supportReason: string) {
  try {
    return await updateEvent(await contextFor(villageId, supportReason), eventId, data);
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "ไม่สามารถแก้ไขกิจกรรมได้" };
  }
}

export async function deleteSuperAdminVillageEventAction(villageId: string, eventId: string, supportReason: string) {
  try {
    return await deleteEvent(await contextFor(villageId, supportReason), eventId);
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "ไม่สามารถลบกิจกรรมได้" };
  }
}

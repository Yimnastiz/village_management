"use server";

import { MembershipStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { canManagePopulation, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { createVillagePerson, deactivateVillagePerson, PopulationValidationError, updateVillagePerson, type VillagePersonInput } from "@/features/population/server/village-population-service";

type PersonActionResult = { success: true; id?: string } | { success: false; error: string };

async function context() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id || !isAdminUser(session)) return null;
  const membership = session.memberships.find((item) => item.status === MembershipStatus.ACTIVE && canManagePopulation(item.role));
  return membership ? { actor: { id: session.id, role: "ADMIN" as const }, villageId: membership.villageId } : null;
}

function toActionError(error: unknown) {
  if (error instanceof PopulationValidationError) return error.message;
  console.error("[population] person action failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
  return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}

export async function createPersonAction(data: VillagePersonInput): Promise<PersonActionResult> {
  const current = await context();
  if (!current) return { success: false, error: "คุณไม่มีสิทธิ์เพิ่มข้อมูลประชากร" };
  try {
    const person = await createVillagePerson(current.villageId, data, current.actor);
    revalidatePath("/admin/population/people");
    return { success: true, id: person.id };
  } catch (error) { return { success: false, error: toActionError(error) }; }
}

export async function updatePersonAction(personId: string, data: VillagePersonInput): Promise<PersonActionResult> {
  const current = await context();
  if (!current) return { success: false, error: "คุณไม่มีสิทธิ์แก้ไขข้อมูลประชากร" };
  try {
    await updateVillagePerson(current.villageId, personId, data, current.actor);
    revalidatePath("/admin/population/people");
    revalidatePath(`/admin/population/people/${personId}`);
    return { success: true };
  } catch (error) { return { success: false, error: toActionError(error) }; }
}

export async function deletePersonAction(personId: string, reason: string): Promise<PersonActionResult> {
  const current = await context();
  if (!current) return { success: false, error: "คุณไม่มีสิทธิ์บันทึกการย้ายออก" };
  try {
    await deactivateVillagePerson(current.villageId, personId, reason, current.actor);
    revalidatePath("/admin/population/people");
    revalidatePath(`/admin/population/people/${personId}`);
    return { success: true };
  } catch (error) { return { success: false, error: toActionError(error) }; }
}

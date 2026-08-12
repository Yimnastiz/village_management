"use server";
import { requireSuperAdminActionSession } from "@/lib/superadmin";
import { assertTargetVillage } from "@/features/population/server/village-population-service";
import { importPopulationWorkbookAction, type ImportActionState } from "@/app/(admin)/admin/population/import/actions";
import { confirmPopulationImportAction } from "@/app/(admin)/admin/population/import/[jobId]/actions";

export async function importForWorkspaceAction(villageId: string, state: ImportActionState | null, formData: FormData) {
  await requireSuperAdminActionSession();
  await assertTargetVillage(villageId);
  formData.set("targetVillageId", villageId);
  return importPopulationWorkbookAction(state, formData);
}

export async function confirmWorkspaceImportAction(villageId: string, formData: FormData) {
  await requireSuperAdminActionSession();
  await assertTargetVillage(villageId);
  formData.set("targetVillageId", villageId);
  return confirmPopulationImportAction(formData);
}

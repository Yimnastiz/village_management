"use client";

import { PopulationImportForm } from "@/app/(admin)/admin/population/import/import-form";
import { importForWorkspaceAction } from "./actions";

export function WorkspacePopulationImportForm({ villageId }: { villageId: string }) {
  return <PopulationImportForm targetVillageId={villageId} templateHref="/api/superadmin/population/import-template" importAction={(state, formData) => importForWorkspaceAction(villageId, state, formData)} />;
}

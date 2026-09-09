"use server";

import { revalidatePath } from "next/cache";
import { requireVillageActionPermission } from "@/lib/admin-permission.server";
import { cancelVillageBroadcast, createVillageBroadcast, updateVillageBroadcast } from "@/features/broadcasts/server/broadcast-service";

function paths(id?: string) { for (const path of ["/admin/broadcasts", ...(id ? [`/admin/broadcasts/${id}`] : []), "/admin/dashboard", "/admin/news", "/admin/notifications", "/resident/dashboard", "/resident/news", "/resident/notifications"]) revalidatePath(path); }
async function context() { const value = await requireVillageActionPermission("broadcasts.manage"); return { userId: value.session.id, villageId: value.villageId, actorRole: value.membership.role }; }
export async function createAdminVillageBroadcastAction(formData: FormData) { const id = await createVillageBroadcast(formData, await context()); paths(id); }
export async function updateAdminVillageBroadcastAction(formData: FormData) { const id = String(formData.get("broadcastGroupId") ?? "").trim(); await updateVillageBroadcast(formData, await context()); paths(id); }
export async function cancelAdminVillageBroadcastAction(formData: FormData) { const id = String(formData.get("broadcastGroupId") ?? "").trim(); await cancelVillageBroadcast(formData, await context()); paths(id); }

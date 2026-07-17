"use server";

import { requireAdminVillageContext } from "@/features/village-public-content/server/context";
import {
  createContact,
  deleteContact,
  updateContact,
  type ContactInput,
} from "@/features/village-public-content/server/service";

export async function createContactAction(
  data: ContactInput
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const ctx = await requireAdminVillageContext();
  if (!ctx.ok) return { success: false, error: ctx.error };
  return createContact(ctx.context, data);
}

export async function updateContactAction(
  id: string,
  data: ContactInput
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillageContext();
  if (!ctx.ok) return { success: false, error: ctx.error };
  return updateContact(ctx.context, id, data);
}

export async function deleteContactAction(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillageContext();
  if (!ctx.ok) return { success: false, error: ctx.error };
  return deleteContact(ctx.context, id);
}


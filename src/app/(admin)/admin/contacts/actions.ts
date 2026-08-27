"use server";

import { AuditAction, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminVillageContext } from "@/features/village-public-content/server/context";
import {
  createContact,
  deleteContact,
  updateContact,
  type ContactInput,
  type ContactUpdateInput,
} from "@/features/village-public-content/server/service";
import { prisma } from "@/lib/prisma";
import { ActionReasonError, requireActionReason } from "@/lib/sensitive-action-policy";

const reorderSchema = z.object({ contactIds: z.array(z.string().min(1)).min(1) });

export async function createContactAction(
  data: ContactInput
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const ctx = await requireAdminVillageContext("contacts.manage");
  if (!ctx.ok) return { success: false, error: ctx.error };
  return createContact(ctx.context, data);
}

export async function updateContactAction(
  id: string,
  data: ContactUpdateInput
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillageContext("contacts.manage");
  if (!ctx.ok) return { success: false, error: ctx.error };
  return updateContact(ctx.context, id, data);
}

export async function deleteContactAction(
  id: string,
  reason: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillageContext("contacts.manage");
  if (!ctx.ok) return { success: false, error: ctx.error };
  try { return deleteContact(ctx.context, id, requireActionReason("content.delete", reason)); }
  catch (error) { if (error instanceof ActionReasonError) return { success: false, error: "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร" }; throw error; }
}

export async function reorderContactsAction(contactIds: string[]): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillageContext("contacts.manage");
  if (!ctx.ok) return { success: false, error: ctx.error };
  const parsed = reorderSchema.safeParse({ contactIds });
  if (!parsed.success) return { success: false, error: "ลำดับผู้ติดต่อไม่ถูกต้อง" };
  if (new Set(parsed.data.contactIds).size !== parsed.data.contactIds.length) {
    return { success: false, error: "ลำดับผู้ติดต่อมีข้อมูลซ้ำ" };
  }

  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await prisma.$transaction(async (tx) => {
          const contacts = await tx.contactDirectory.findMany({
            where: { villageId: ctx.context.villageId },
            select: { id: true },
          });
          const expectedIds = new Set(contacts.map((contact) => contact.id));
          const submittedIds = new Set(parsed.data.contactIds);
          if (contacts.length !== parsed.data.contactIds.length || submittedIds.size !== expectedIds.size || [...submittedIds].some((id) => !expectedIds.has(id))) {
            throw new Error("CONTACT_REORDER_SET_MISMATCH");
          }

          await Promise.all(parsed.data.contactIds.map((id, sortOrder) => tx.contactDirectory.update({ where: { id }, data: { sortOrder } })));
          await tx.auditLog.create({
            data: {
              userId: ctx.context.actorUserId,
              villageId: ctx.context.villageId,
              action: AuditAction.UPDATE,
              resource: "ContactDirectory",
              metadata: { actionName: "CONTACT_REORDER", count: parsed.data.contactIds.length, actorRole: ctx.context.actorRole },
            },
          });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        revalidatePath("/admin/contacts");
        revalidatePath("/resident/contacts");
        return { success: true };
      } catch (error) {
        if (error instanceof Error && error.message === "CONTACT_REORDER_SET_MISMATCH") return { success: false, error: "รายการผู้ติดต่อมีการเปลี่ยนแปลง กรุณารีเฟรชแล้วลองอีกครั้ง" };
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034" || attempt === 2) throw error;
      }
    }
  } catch (error) {
    console.error("reorder contacts", error);
    return { success: false, error: "บันทึกลำดับไม่สำเร็จ" };
  }
  return { success: false, error: "บันทึกลำดับไม่สำเร็จ" };
}

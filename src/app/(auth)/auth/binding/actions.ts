"use server";

import { AuditAction, BindingRequestStatus, MembershipStatus, VillageMembershipRole, NotificationType } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { revalidateAdminSidebar } from "@/lib/revalidate-admin-sidebar";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { isValidHouseNumber, normalizeHouseNumber } from "@/lib/house-number";
import { isAccessMembershipStatus } from "@/lib/settings-access";

async function ensurePendingBindingMembership(userId: string, villageId: string) {
  const existing = await prisma.villageMembership.findUnique({ where: { userId_villageId: { userId, villageId } }, select: { status: true } });
  // A request is workflow state only. Never downgrade an existing real member.
  if (existing && isAccessMembershipStatus(existing.status)) return;
  await prisma.villageMembership.upsert({
    where: { userId_villageId: { userId, villageId } },
    update: { role: VillageMembershipRole.RESIDENT, status: MembershipStatus.PENDING, houseId: null },
    create: { userId, villageId, role: VillageMembershipRole.RESIDENT, status: MembershipStatus.PENDING },
  });
}

function toOptionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type BindingRequestActionState = {
  success: boolean;
  message?: string;
  fieldErrors?: { house?: string; village?: string };
};

export async function submitBindingRequestAction(
  _previousState: BindingRequestActionState,
  formData: FormData,
): Promise<BindingRequestActionState> {
  const session = await getSessionContextFromServerCookies();
  if (!session) {
    if (process.env.NODE_ENV === "development") console.log("[binding] no session", { hasSession: false });
    redirect("/auth/login");
  }

  const villageId = toOptionalString(formData.get("villageId"));
  const requestedHouseId = toOptionalString(formData.get("requestedHouseId"));
  const rawHouseNumber = toOptionalString(formData.get("houseNumber"));
  const note = toOptionalString(formData.get("note"));

  if (!villageId) return { success: false, fieldErrors: { village: "กรุณาเลือกหมู่บ้าน" } };
  if (!requestedHouseId && !rawHouseNumber) return { success: false, fieldErrors: { house: "กรุณาเลือกเลขบ้านที่มีอยู่ หรือเสนอเลขบ้านให้ผู้ใหญ่บ้านตรวจสอบ" } };
  if (requestedHouseId && rawHouseNumber) return { success: false, fieldErrors: { house: "กรุณาเลือกบ้านที่มีอยู่ หรือเสนอเลขบ้านใหม่อย่างใดอย่างหนึ่ง" } };

  if (!villageId) {
    throw new Error("Village is required.");
  }
  if (!requestedHouseId && !rawHouseNumber) throw new Error("กรุณาเลือกบ้าน หรือเสนอเลขบ้านให้ผู้ใหญ่บ้านตรวจสอบ");
  const villageExists = await prisma.village.findFirst({ where: { id: villageId, isActive: true }, select: { id: true } });
  if (!villageExists) return { success: false, fieldErrors: { village: "ไม่พบหมู่บ้านที่เลือก" } };
  if (!villageExists) throw new Error("Village not found.");

  let houseId: string | null = null;
  let houseNumber: string | null = null;
  const linkedPerson = await prisma.person.findUnique({ where: { userId: session.id }, select: { houseId: true, house: { select: { houseNumber: true } } } });
  if (requestedHouseId) {
    const house = await prisma.house.findFirst({ where: { id: requestedHouseId, villageId }, select: { id: true, houseNumber: true } });
    if (!house) return { success: false, fieldErrors: { house: "บ้านที่เลือกไม่ได้อยู่ในหมู่บ้านนี้" } };
    if (!house) throw new Error("บ้านที่เลือกไม่ได้อยู่ในหมู่บ้านนี้");
    houseId = house.id;
    houseNumber = house.houseNumber;
  } else {
    houseNumber = normalizeHouseNumber(rawHouseNumber!);
    if (!isValidHouseNumber(houseNumber)) return { success: false, fieldErrors: { house: "รูปแบบเลขบ้านไม่ถูกต้อง" } };
    if (!isValidHouseNumber(houseNumber)) throw new Error("รูปแบบเลขบ้านไม่ถูกต้อง");
    const existing = await prisma.house.findUnique({ where: { villageId_normalizedHouseNumber: { villageId, normalizedHouseNumber: houseNumber } }, select: { id: true } });
    if (existing) return { success: false, fieldErrors: { house: "เลขบ้านนี้มีอยู่ในระบบแล้ว กรุณาเลือกจากรายการ" } };
    if (existing) throw new Error("พบเลขบ้านนี้ในระบบแล้ว กรุณาเลือกบ้านจากรายการ");
  }

  const personHouseMismatch = Boolean(linkedPerson?.houseId && linkedPerson.houseId !== houseId);
  const bindingNote = personHouseMismatch
    ? `${note ?? ""}${note ? " " : ""}ข้อมูลทะเบียนประชากรระบุบ้านเลขที่ ${linkedPerson?.house?.houseNumber ?? "ไม่ระบุ"} แต่คำขอนี้เลือกหรือเสนอเลขบ้านต่างกัน กรุณาตรวจสอบ`
    : note;

  // This is the selected public village context; it grants no membership access.
  await prisma.user.update({ where: { id: session.id }, data: { registrationVillageId: villageId } });

  const existingPending = await prisma.bindingRequest.findFirst({
    where: {
      userId: session.id,
      status: BindingRequestStatus.PENDING,
    },
    select: { id: true, villageId: true },
  });

  if (existingPending) {
    if (existingPending.villageId && existingPending.villageId !== villageId) return { success: false, message: "มีคำขอผูกบ้านของหมู่บ้านอื่นกำลังรอตรวจสอบอยู่" };
    if (existingPending.villageId && existingPending.villageId !== villageId) throw new Error("มีคำขอผูกบ้านของหมู่บ้านอื่นกำลังรอตรวจสอบอยู่");
    await prisma.bindingRequest.update({
      where: { id: existingPending.id },
      data: {
        // Keep original village while request is pending to avoid duplicate multi-village requests.
        houseId,
        houseNumber,
        note: bindingNote,
      },
    });

    await ensurePendingBindingMembership(session.id, existingPending.villageId ?? villageId);

    revalidatePath("/resident/binding");
    revalidateAdminSidebar();
    revalidatePath("/resident/binding/pending");
    redirect("/resident/binding/pending");
  } else {
    const createdBinding = await prisma.bindingRequest.create({
      data: {
        userId: session.id,
        villageId,
        houseId,
        houseNumber,
        note: bindingNote,
        status: BindingRequestStatus.PENDING,
      },
      include: {
        user: {
          select: { name: true, phoneNumber: true },
        },
        village: {
          select: {
            id: true,
            name: true,
            memberships: {
              where: { role: { in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN, VillageMembershipRole.COMMITTEE] } },
              select: { userId: true },
            },
          },
        },
      },
    });

    // Notify admin users of the village about new binding request
    if (createdBinding.village?.memberships) {
      const adminUserIds = createdBinding.village.memberships.map((m) => m.userId);
      if (adminUserIds.length > 0) {
        await prisma.notification.createMany({
          data: adminUserIds.map((adminUserId) => ({
            userId: adminUserId,
            villageId: createdBinding.villageId,
            type: NotificationType.BINDING_REQUEST,
            title: "มีคำขอผูกเลขบ้านใหม่",
            body: `${createdBinding.user.name} (${createdBinding.user.phoneNumber}) ส่งคำขอผูกเลขบ้าน กรุณาตรวจสอบรายละเอียด`,
            metadata: { bindingRequestId: createdBinding.id },
          })),
        });
      }
    }
  }

  await ensurePendingBindingMembership(session.id, villageId);

  revalidatePath("/resident/binding");
  revalidateAdminSidebar();
  revalidatePath("/resident/binding/pending");
  redirect("/resident/binding/pending");
}

export async function cancelBindingRequestAction() {
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/resident/binding");
  const pending = await prisma.bindingRequest.findFirst({
    where: { userId: session.id, status: BindingRequestStatus.PENDING },
    orderBy: { createdAt: "desc" },
    select: { id: true, villageId: true },
  });
  if (!pending) throw new Error("ไม่พบคำขอที่กำลังรออนุมัติ");

  await prisma.$transaction(async (tx) => {
    await tx.bindingRequest.update({
      where: { id: pending.id },
      data: { status: BindingRequestStatus.CANCELLED },
    });
    await tx.auditLog.create({
      data: {
        userId: session.id,
        villageId: pending.villageId,
        action: AuditAction.UPDATE,
        resource: "BindingRequest",
        resourceId: pending.id,
        metadata: { previousStatus: BindingRequestStatus.PENDING, status: BindingRequestStatus.CANCELLED, source: "resident-self-service" },
      },
    });
    if (pending.villageId) {
      await tx.villageMembership.deleteMany({
        where: { userId: session.id, villageId: pending.villageId, role: VillageMembershipRole.RESIDENT, status: MembershipStatus.PENDING },
      });
    }
  });
  revalidatePath("/resident/binding");
  revalidateAdminSidebar();
  revalidatePath("/resident/binding/pending");
}

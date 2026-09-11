"use server";

import { AuditAction, BindingRequestStatus, MembershipStatus, VillageMembershipRole, NotificationType } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { revalidateAdminSidebar } from "@/lib/revalidate-admin-sidebar";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { isValidHouseNumber, normalizeHouseNumber } from "@/lib/house-number";
import { isAccessMembershipStatus } from "@/lib/settings-access";
import { getConfiguredVillage } from "@/lib/configured-village";

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
  fieldErrors?: { house?: string };
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

  const village = await getConfiguredVillage();
  const villageId = village.id;
  const requestedHouseId = toOptionalString(formData.get("requestedHouseId"));
  const rawHouseNumber = toOptionalString(formData.get("houseNumber"));
  const note = toOptionalString(formData.get("note"));

  if (!requestedHouseId && !rawHouseNumber) return { success: false, fieldErrors: { house: "กรุณาเลือกเลขบ้านที่มีอยู่ หรือเสนอเลขบ้านให้ผู้ใหญ่บ้านตรวจสอบ" } };
  if (requestedHouseId && rawHouseNumber) return { success: false, fieldErrors: { house: "กรุณาเลือกบ้านที่มีอยู่ หรือเสนอเลขบ้านใหม่อย่างใดอย่างหนึ่ง" } };

  let houseId: string | null = null;
  let houseNumber: string | null = null;
  const linkedPerson = await prisma.person.findUnique({ where: { userId: session.id }, select: { houseId: true, house: { select: { houseNumber: true } } } });
  if (requestedHouseId) {
    const house = await prisma.house.findFirst({ where: { id: requestedHouseId, villageId }, select: { id: true, houseNumber: true } });
    if (!house) return { success: false, fieldErrors: { house: "บ้านที่เลือกไม่ได้อยู่ในหมู่บ้านนี้" } };
    houseId = house.id;
    houseNumber = house.houseNumber;
  } else {
    houseNumber = normalizeHouseNumber(rawHouseNumber!);
    if (!isValidHouseNumber(houseNumber)) return { success: false, fieldErrors: { house: "รูปแบบเลขบ้านไม่ถูกต้อง" } };
    const existing = await prisma.house.findUnique({ where: { villageId_normalizedHouseNumber: { villageId, normalizedHouseNumber: houseNumber } }, select: { id: true } });
    if (existing) return { success: false, fieldErrors: { house: "เลขบ้านนี้มีอยู่ในระบบแล้ว กรุณาเลือกจากรายการ" } };
  }

  const personHouseMismatch = Boolean(linkedPerson?.houseId && linkedPerson.houseId !== houseId);
  const bindingNote = personHouseMismatch
    ? `${note ?? ""}${note ? " " : ""}ข้อมูลทะเบียนประชากรระบุบ้านเลขที่ ${linkedPerson?.house?.houseNumber ?? "ไม่ระบุ"} แต่คำขอนี้เลือกหรือเสนอเลขบ้านต่างกัน กรุณาตรวจสอบ`
    : note;

  const existingPending = await prisma.bindingRequest.findFirst({
    where: {
      userId: session.id,
      villageId,
      status: BindingRequestStatus.PENDING,
    },
    select: { id: true },
  });

  if (existingPending) {
    await prisma.bindingRequest.update({
      where: { id: existingPending.id },
      data: {
        houseId,
        houseNumber,
        note: bindingNote,
      },
    });

    await ensurePendingBindingMembership(session.id, villageId);

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
              where: { role: VillageMembershipRole.HEADMAN, status: MembershipStatus.ACTIVE },
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
            metadata: { source: "BINDING", bindingRequestId: createdBinding.id },
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
  const village = await getConfiguredVillage();
  const pending = await prisma.bindingRequest.findFirst({
    where: { userId: session.id, villageId: village.id, status: BindingRequestStatus.PENDING },
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

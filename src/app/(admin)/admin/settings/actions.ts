"use server";

import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

const ADMIN_MEMBERSHIP_ROLES = new Set<VillageMembershipRole>([
  VillageMembershipRole.HEADMAN,
  VillageMembershipRole.ASSISTANT_HEADMAN,
  VillageMembershipRole.COMMITTEE,
]);

async function requireAdminVillageContext() {
  const session = await getSessionContextFromServerCookies();
  if (!session) {
    redirect("/auth/login?callbackUrl=/admin/settings");
  }
  if (!isAdminUser(session)) {
    redirect(computeLandingPath(session));
  }

  const membership = await prisma.villageMembership.findFirst({
    where: {
      userId: session.id,
      status: MembershipStatus.ACTIVE,
      role: { in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN, VillageMembershipRole.COMMITTEE] },
    },
    select: { villageId: true },
  });

  if (!membership) {
    throw new Error("ไม่พบหมู่บ้านที่คุณมีสิทธิ์จัดการ");
  }

  return {
    session,
    villageId: membership.villageId,
  };
}

function cleanString(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function updateVillageSettingsAction(formData: FormData) {
  const { villageId } = await requireAdminVillageContext();

  const name = cleanString(formData, "name");
  if (!name) {
    throw new Error("กรุณาระบุชื่อหมู่บ้าน");
  }

  await prisma.village.update({
    where: { id: villageId },
    data: {
      name,
      description: cleanString(formData, "description"),
      address: cleanString(formData, "address"),
      province: cleanString(formData, "province"),
      district: cleanString(formData, "district"),
      subdistrict: cleanString(formData, "subdistrict"),
      phone: cleanString(formData, "phone"),
      email: cleanString(formData, "email"),
      website: cleanString(formData, "website"),
      logoUrl: cleanString(formData, "logoUrl"),
      bannerUrl: cleanString(formData, "bannerUrl"),
      isActive: formData.get("isActive") === "on",
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/village");
}

export async function updateVillageMemberAccessAction(formData: FormData) {
  const { session, villageId } = await requireAdminVillageContext();

  const membershipId = cleanString(formData, "membershipId");
  const nextRole = cleanString(formData, "role") as VillageMembershipRole | null;
  const nextStatus = cleanString(formData, "status") as MembershipStatus | null;

  if (!membershipId || !nextRole || !nextStatus) {
    throw new Error("ข้อมูลการปรับสิทธิ์ไม่ครบถ้วน");
  }

  if (!Object.values(VillageMembershipRole).includes(nextRole)) {
    throw new Error("role ไม่ถูกต้อง");
  }

  if (!Object.values(MembershipStatus).includes(nextStatus)) {
    throw new Error("status ไม่ถูกต้อง");
  }

  const target = await prisma.villageMembership.findUnique({
    where: { id: membershipId },
    select: { id: true, userId: true, villageId: true, role: true, status: true },
  });

  if (!target || target.villageId !== villageId) {
    throw new Error("ไม่พบสมาชิกในหมู่บ้านนี้");
  }

  const isEditingSelf = target.userId === session.id;
  if (isEditingSelf) {
    if (!ADMIN_MEMBERSHIP_ROLES.has(nextRole) || nextStatus !== MembershipStatus.ACTIVE) {
      throw new Error("ไม่สามารถลดสิทธิ์หรือปิดสถานะบัญชีของตนเองได้");
    }
  }

  await prisma.villageMembership.update({
    where: { id: membershipId },
    data: {
      role: nextRole,
      status: nextStatus,
      joinedAt: nextStatus === MembershipStatus.ACTIVE ? target.status === MembershipStatus.ACTIVE ? undefined : new Date() : null,
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/roles");
}
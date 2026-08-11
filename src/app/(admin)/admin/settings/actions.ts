"use server";

import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { computeLandingPath, getAdminMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
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
  const membership = getAdminMembership(session);

  if (!membership) {
    redirect(computeLandingPath(session));
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

export async function updateVillageSettingsAction(formData: FormData): Promise<{ success: true } | { success: false; error: string }> {
  const { villageId } = await requireAdminVillageContext();

  const email = cleanString(formData, "email");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { success: false, error: "รูปแบบอีเมลไม่ถูกต้อง" };

  await prisma.village.update({
    where: { id: villageId },
    data: {
      description: cleanString(formData, "description"),
      address: cleanString(formData, "address"),
      phone: cleanString(formData, "phone"),
      email,
      website: cleanString(formData, "website"),
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/village");
  return { success: true };
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

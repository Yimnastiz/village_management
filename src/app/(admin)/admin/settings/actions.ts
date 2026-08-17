"use server";

import { AuditAction, MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { computeLandingPath, getAdminMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { isSafeImageSource } from "@/lib/image-input";
import { prisma } from "@/lib/prisma";
import { isAccessMembershipStatus } from "@/lib/settings-access";

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
  const website = cleanString(formData, "website");
  if (website) {
    try {
      const url = new URL(website);
      if (url.protocol !== "http:" && url.protocol !== "https:") return { success: false, error: "เว็บไซต์ต้องขึ้นต้นด้วย http:// หรือ https://" };
    } catch {
      return { success: false, error: "รูปแบบเว็บไซต์ไม่ถูกต้อง" };
    }
  }

  const village = await prisma.village.update({
    where: { id: villageId },
    data: {
      description: cleanString(formData, "description"),
      address: cleanString(formData, "address"),
      phone: cleanString(formData, "phone"),
      email,
      website,
    },
    select: { slug: true },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/village");
  revalidatePath(`/${village.slug}`);
  revalidatePath(`/${village.slug}`, "layout");
  return { success: true };
}

export async function updatePersonalSettingsAction(data: { email: string; image: string | null }): Promise<{ success: true } | { success: false; error: string }> {
  const { session } = await requireAdminVillageContext();
  const email = data.email.trim() || null;
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { success: false, error: "รูปแบบอีเมลไม่ถูกต้อง" };
  if (data.image && !isSafeImageSource(data.image)) {
    return { success: false, error: "รูปโปรไฟล์ไม่ถูกต้อง" };
  }
  const conflict = email ? await prisma.user.findFirst({ where: { email, id: { not: session.id } }, select: { id: true } }) : null;
  if (conflict) return { success: false, error: "อีเมลนี้ถูกใช้งานแล้ว" };
  const current = await prisma.user.findUniqueOrThrow({ where: { id: session.id }, select: { email: true } });
  await prisma.user.update({
    where: { id: session.id },
    data: { email, image: data.image, ...(email !== current.email ? { emailVerified: false } : {}) },
  });
  await prisma.person.updateMany({ where: { userId: session.id }, data: { email } });
  revalidatePath("/admin/settings/profile");
  revalidatePath("/admin", "layout");
  return { success: true };
}

export async function updateVillageMemberAccessAction(formData: FormData): Promise<{ success: true } | { success: false; error: string }> {
  const { session, villageId } = await requireAdminVillageContext();

  const membershipId = cleanString(formData, "membershipId");
  const nextRole = cleanString(formData, "role") as VillageMembershipRole | null;
  const nextStatus = cleanString(formData, "status") as MembershipStatus | null;
  const reason = cleanString(formData, "reason");

  if (!membershipId || !nextRole || !nextStatus) {
    return { success: false, error: "ข้อมูลการปรับสิทธิ์ไม่ครบถ้วน" };
  }

  if (!Object.values(VillageMembershipRole).includes(nextRole)) {
    return { success: false, error: "บทบาทไม่ถูกต้อง" };
  }

  if (!isAccessMembershipStatus(nextStatus)) {
    return { success: false, error: "สถานะสิทธิ์ไม่ถูกต้อง" };
  }

  const target = await prisma.villageMembership.findUnique({
    where: { id: membershipId },
    select: { id: true, userId: true, villageId: true, role: true, status: true, joinedAt: true },
  });

  if (!target || target.villageId !== villageId) {
    return { success: false, error: "ไม่พบสมาชิกในหมู่บ้านนี้" };
  }

  if (!isAccessMembershipStatus(target.status)) {
    return { success: false, error: "ผู้ใช้นี้ยังไม่ใช่สมาชิกที่จัดการสิทธิ์ได้" };
  }

  const isEditingSelf = target.userId === session.id;
  if (isEditingSelf) {
    if (!ADMIN_MEMBERSHIP_ROLES.has(nextRole) || nextStatus !== MembershipStatus.ACTIVE) {
      return { success: false, error: "ไม่สามารถลดสิทธิ์หรือระงับการใช้งานของตนเองได้" };
    }
  }

  const targetUser = await prisma.user.findUnique({ where: { id: target.userId }, select: { name: true } });
  await prisma.$transaction(async (tx) => {
    await tx.villageMembership.update({
      where: { id: membershipId },
      data: {
        role: nextRole,
        status: nextStatus,
        // joinedAt records that this person became a real member; suspension must not erase it.
        joinedAt: nextStatus === MembershipStatus.ACTIVE && !target.joinedAt ? new Date() : undefined,
      },
    });
    if (target.role !== nextRole || target.status !== nextStatus) {
      await tx.auditLog.create({
        data: {
          userId: session.id,
          villageId,
          action: AuditAction.UPDATE,
          resource: "VillageMembership",
          resourceId: membershipId,
          metadata: {
            actionName: target.status !== nextStatus ? (nextStatus === MembershipStatus.SUSPENDED ? "MEMBER_SUSPENDED" : "MEMBER_REACTIVATED") : "MEMBER_ROLE_CHANGED",
            name: targetUser?.name ?? "สมาชิก",
            reason,
            oldValue: { role: target.role, status: target.status },
            newValue: { role: nextRole, status: nextStatus },
          },
        },
      });
    }
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/roles");
  revalidatePath("/admin/settings/access");
  revalidatePath("/admin/security");
  return { success: true };
}

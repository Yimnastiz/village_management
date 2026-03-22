"use server";

import {
  MembershipStatus,
  SystemRole,
  VillageMembershipRole,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function toNonEmptyString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhoneNumber(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

export async function createVillageAction(formData: FormData) {
  const slug = toNonEmptyString(formData.get("slug"));
  const name = toNonEmptyString(formData.get("name"));
  const province = toNonEmptyString(formData.get("province"));
  const district = toNonEmptyString(formData.get("district"));
  const subdistrict = toNonEmptyString(formData.get("subdistrict"));

  if (!slug || !name || !province || !district || !subdistrict) {
    throw new Error("Missing required village fields.");
  }

  await prisma.village.upsert({
    where: { slug },
    update: {
      name,
      province,
      district,
      subdistrict,
      isActive: true,
    },
    create: {
      slug,
      name,
      province,
      district,
      subdistrict,
      isActive: true,
    },
  });

  revalidatePath("/dev");
}

export async function upsertPhoneRoleSeedAction(formData: FormData) {
  const rawPhone = toNonEmptyString(formData.get("phoneNumber"));
  const villageId = toNonEmptyString(formData.get("villageId"));
  const membershipRoleRaw = toNonEmptyString(formData.get("membershipRole"));
  const systemRoleRaw = toNonEmptyString(formData.get("systemRole"));
  const note = toNonEmptyString(formData.get("note"));
  const isCitizenVerified = formData.get("isCitizenVerified") === "on";

  if (!rawPhone) {
    throw new Error("Phone number is required.");
  }

  const phoneNumber = normalizePhoneNumber(rawPhone);
  if (!/^\+?\d{9,15}$/.test(phoneNumber)) {
    throw new Error("Invalid phone number format.");
  }

  const membershipRole =
    membershipRoleRaw && membershipRoleRaw in VillageMembershipRole
      ? (membershipRoleRaw as VillageMembershipRole)
      : VillageMembershipRole.RESIDENT;

  const systemRole =
    systemRoleRaw && systemRoleRaw in SystemRole
      ? (systemRoleRaw as SystemRole)
      : null;

  await prisma.phoneRoleSeed.upsert({
    where: { phoneNumber },
    update: {
      villageId,
      membershipRole,
      systemRole,
      note,
      isCitizenVerified,
    },
    create: {
      phoneNumber,
      villageId,
      membershipRole,
      systemRole,
      note,
      isCitizenVerified,
    },
  });

  revalidatePath("/dev");
}

export async function updateUserRoleAction(formData: FormData) {
  const userId = toNonEmptyString(formData.get("userId"));
  const systemRoleRaw = toNonEmptyString(formData.get("systemRole"));
  const villageId = toNonEmptyString(formData.get("villageId"));
  const membershipRoleRaw = toNonEmptyString(formData.get("membershipRole"));
  const membershipStatusRaw = toNonEmptyString(formData.get("membershipStatus"));

  if (!userId) {
    throw new Error("Missing userId.");
  }

  const systemRole =
    systemRoleRaw && systemRoleRaw in SystemRole
      ? (systemRoleRaw as SystemRole)
      : SystemRole.USER;

  await prisma.user.update({
    where: { id: userId },
    data: { systemRole },
  });

  if (villageId) {
    const membershipRole =
      membershipRoleRaw && membershipRoleRaw in VillageMembershipRole
        ? (membershipRoleRaw as VillageMembershipRole)
        : VillageMembershipRole.RESIDENT;

    const membershipStatus =
      membershipStatusRaw && membershipStatusRaw in MembershipStatus
        ? (membershipStatusRaw as MembershipStatus)
        : MembershipStatus.ACTIVE;

    await prisma.villageMembership.upsert({
      where: {
        userId_villageId: {
          userId,
          villageId,
        },
      },
      update: {
        role: membershipRole,
        status: membershipStatus,
        joinedAt: membershipStatus === MembershipStatus.ACTIVE ? new Date() : null,
      },
      create: {
        userId,
        villageId,
        role: membershipRole,
        status: membershipStatus,
        joinedAt: membershipStatus === MembershipStatus.ACTIVE ? new Date() : null,
      },
    });
  }

  revalidatePath("/dev");
}

export async function registerAdminAction(formData: FormData) {
  const rawPhone = toNonEmptyString(formData.get("phoneNumber"));
  const adminName = toNonEmptyString(formData.get("adminName"));
  const adminLastName = toNonEmptyString(formData.get("lastName"));
  const villageId = toNonEmptyString(formData.get("villageId"));
  const houseNumber = toNonEmptyString(formData.get("houseNumber"));
  const nationalId = toNonEmptyString(formData.get("nationalId"));
  const membershipRoleRaw = toNonEmptyString(formData.get("membershipRole"));

  if (!rawPhone || !adminName || !adminLastName || !villageId) {
    throw new Error("Phone, first name, last name, and village are required.");
  }

  const phoneNumber = normalizePhoneNumber(rawPhone);
  if (!/^\+?\d{9,15}$/.test(phoneNumber)) {
    throw new Error("Invalid phone number format.");
  }

  const membershipRole =
    membershipRoleRaw === VillageMembershipRole.HEADMAN ||
    membershipRoleRaw === VillageMembershipRole.ASSISTANT_HEADMAN
      ? (membershipRoleRaw as VillageMembershipRole)
      : VillageMembershipRole.RESIDENT;

  // Verify village exists
  const village = await prisma.village.findUnique({
    where: { id: villageId },
  });
  if (!village) {
    throw new Error("Village not found.");
  }

  // Check role limits
  if (membershipRole === VillageMembershipRole.HEADMAN) {
    const headmanCount = await prisma.villageMembership.count({
      where: {
        villageId,
        role: VillageMembershipRole.HEADMAN,
        status: MembershipStatus.ACTIVE,
      },
    });
    if (headmanCount >= 1) {
      throw new Error("Village already has 1 headman. Cannot add more.");
    }
  } else if (membershipRole === VillageMembershipRole.ASSISTANT_HEADMAN) {
    const assistantCount = await prisma.villageMembership.count({
      where: {
        villageId,
        role: VillageMembershipRole.ASSISTANT_HEADMAN,
        status: MembershipStatus.ACTIVE,
      },
    });
    if (assistantCount >= 2) {
      throw new Error("Village already has 2 assistant headmen. Cannot add more.");
    }
  }

  // Create or find user
  let user = await prisma.user.findUnique({
    where: { phoneNumber },
  });

  const fullName = `${adminName} ${adminLastName}`;

  if (!user) {
    user = await prisma.user.create({
      data: {
        phoneNumber,
        phoneNumberVerified: true,
        name: fullName,
        systemRole: SystemRole.USER,
        citizenVerifiedAt: new Date(),
      },
    });
  } else {
    // Update existing user if needed
    const shouldUpdateName = !user.name || user.name === phoneNumber;
    if (shouldUpdateName) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          name: fullName,
          citizenVerifiedAt: new Date(),
        },
      });
    }
  }

  // Create house if house number provided
  let house = null;
  if (houseNumber) {
    house = await prisma.house.upsert({
      where: {
        villageId_houseNumber: {
          villageId,
          houseNumber,
        },
      },
      update: {},
      create: {
        villageId,
        houseNumber,
      },
    });
  }

  // Create person if not exist
  let person = await prisma.person.findFirst({
    where: {
      phone: phoneNumber,
    },
  });

  if (!person) {
    const personData: Record<string, unknown> = {
      villageId,
      firstName: adminName,
      lastName: adminLastName,
      phone: phoneNumber,
    };
    if (house?.id) {
      personData.houseId = house.id;
    }
    if (nationalId) {
      personData.nationalId = nationalId;
    }
    person = await prisma.person.create({
      data: personData as Parameters<typeof prisma.person.create>[0]["data"],
    });
  }

  // Create village membership
  await prisma.villageMembership.upsert({
    where: {
      userId_villageId: {
        userId: user.id,
        villageId,
      },
    },
    update: {
      role: membershipRole,
      status: MembershipStatus.ACTIVE,
      houseId: house?.id,
      joinedAt: new Date(),
    },
    create: {
      userId: user.id,
      villageId,
      role: membershipRole,
      status: MembershipStatus.ACTIVE,
      houseId: house?.id,
      joinedAt: new Date(),
    },
  });

  // Create phone role seed
  await prisma.phoneRoleSeed.upsert({
    where: { phoneNumber },
    update: {
      villageId,
      membershipRole,
      systemRole: null,
      isCitizenVerified: true,
      note: `Admin: ${adminName} (${membershipRole})`,
    },
    create: {
      phoneNumber,
      villageId,
      membershipRole,
      isCitizenVerified: true,
      note: `Admin: ${adminName} (${membershipRole})`,
    },
  });

  revalidatePath("/dev");
}

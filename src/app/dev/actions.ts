"use server";

import {
  MembershipStatus,
  SystemRole,
  VillageMembershipRole,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { normalizeVillageSlugInput, getSlugVariants } from "@/lib/village-slug";

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

export type VillageActionState = { success: boolean; message: string };

export async function createVillageAction(
  _prevState: VillageActionState | null,
  formData: FormData,
): Promise<VillageActionState> {
  const rawSlug = toNonEmptyString(formData.get("slug"));
  const name = toNonEmptyString(formData.get("name"));
  const province = toNonEmptyString(formData.get("province"));
  const district = toNonEmptyString(formData.get("district"));
  const subdistrict = toNonEmptyString(formData.get("subdistrict"));

  if (!rawSlug || !name || !province || !district || !subdistrict) {
    return { success: false, message: "กรุณากรอกข้อมูลให้ครบทุกช่อง (slug, ชื่อ, จังหวัด, อำเภอ, ตำบล)" };
  }

  const slug = normalizeVillageSlugInput(rawSlug);
  if (!slug) {
    return { success: false, message: "slug ไม่ถูกต้อง กรุณาใช้ตัวอักษร ไทย/อังกฤษ ตัวเลข หรือเครื่องหมาย -" };
  }

  // Check by normalized slug AND its encoded variant (handles legacy garbled slugs)
  const sameSlugVillage = await prisma.village.findFirst({
    where: { slug: { in: getSlugVariants(slug) } },
    select: { id: true, slug: true },
  });

  if (sameSlugVillage) {
    await prisma.village.update({
      where: { id: sameSlugVillage.id },
      data: { slug, name, province, district, subdistrict, isActive: true },
    });
    revalidatePath("/dev");
    const wasRepaired = sameSlugVillage.slug !== slug;
    return {
      success: true,
      message: wasRepaired
        ? `อัปเดตหมู่บ้าน "${name}" สำเร็จ (แก้ไข slug: "${sameSlugVillage.slug}" → "${slug}")`
        : `อัปเดตหมู่บ้าน "${name}" สำเร็จ`,
    };
  }

  const sameVillageByIdentity = await prisma.village.findFirst({
    where: { name, province, district, subdistrict },
    select: { id: true },
  });

  if (sameVillageByIdentity) {
    await prisma.village.update({
      where: { id: sameVillageByIdentity.id },
      data: { slug, name, province, district, subdistrict, isActive: true },
    });
    revalidatePath("/dev");
    return { success: true, message: `อัปเดต slug ของหมู่บ้าน "${name}" เป็น "${slug}" สำเร็จ` };
  }

  await prisma.village.create({
    data: { slug, name, province, district, subdistrict, isActive: true },
  });

  revalidatePath("/dev");
  return { success: true, message: `สร้างหมู่บ้าน "${name}" (slug: "${slug}") สำเร็จ` };
}

export async function repairVillageSlugAction(
  _prevState: VillageActionState | null,
  _formData: FormData,
): Promise<VillageActionState> {
  const villages = await prisma.village.findMany({
    select: { id: true, slug: true, name: true },
  });

  let repaired = 0;
  const errors: string[] = [];

  for (const village of villages) {
    const normalized = normalizeVillageSlugInput(village.slug);
    if (!normalized || normalized === village.slug) continue;

    // Make sure the normalized slug isn't already taken by a different village
    const conflict = await prisma.village.findFirst({
      where: { slug: normalized, NOT: { id: village.id } },
      select: { id: true },
    });
    if (conflict) {
      errors.push(`หมู่บ้าน "${village.name}": slug "${normalized}" ถูกใช้งานแล้ว`);
      continue;
    }

    await prisma.village.update({
      where: { id: village.id },
      data: { slug: normalized },
    });
    repaired++;
  }

  revalidatePath("/dev");

  if (repaired === 0 && errors.length === 0) {
    return { success: true, message: "slug ของทุกหมู่บ้านถูกต้องแล้ว ไม่มีอะไรต้องแก้ไข" };
  }
  const parts: string[] = [];
  if (repaired > 0) parts.push(`แก้ไข slug ${repaired} หมู่บ้านสำเร็จ`);
  if (errors.length > 0) parts.push(`ข้ามไป ${errors.length} รายการ (slug ซ้ำ): ${errors.join("; ")}`);
  return { success: errors.length === 0, message: parts.join(" | ") };
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

function parseOptionalDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function importResidentSeedAction(formData: FormData) {
  const rawPhone = toNonEmptyString(formData.get("phoneNumber"));
  const firstName = toNonEmptyString(formData.get("firstName"));
  const lastName = toNonEmptyString(formData.get("lastName"));
  const villageId = toNonEmptyString(formData.get("villageId"));
  const houseNumber = toNonEmptyString(formData.get("houseNumber"));
  const nationalId = toNonEmptyString(formData.get("nationalId"));
  const email = toNonEmptyString(formData.get("email"));
  const gender = toNonEmptyString(formData.get("gender"));
  const dateOfBirthRaw = toNonEmptyString(formData.get("dateOfBirth"));
  const address = toNonEmptyString(formData.get("address"));
  const note = toNonEmptyString(formData.get("note"));
  const isCitizenVerified = formData.get("isCitizenVerified") === "on";
  const createUserAccount = formData.get("createUserAccount") === "on";

  if (!rawPhone || !firstName || !lastName || !villageId || !houseNumber) {
    throw new Error(
      "Phone, first name, last name, village, and house number are required."
    );
  }

  const phoneNumber = normalizePhoneNumber(rawPhone);
  if (!/^\+?\d{9,15}$/.test(phoneNumber)) {
    throw new Error("Invalid phone number format.");
  }

  if (nationalId && !/^\d{13}$/.test(nationalId)) {
    throw new Error("National ID must be 13 digits.");
  }

  const dateOfBirth = parseOptionalDate(dateOfBirthRaw);
  if (dateOfBirthRaw && !dateOfBirth) {
    throw new Error("Invalid date of birth.");
  }

  const village = await prisma.village.findUnique({
    where: { id: villageId },
    select: {
      id: true,
      province: true,
      district: true,
      subdistrict: true,
    },
  });

  if (!village) {
    throw new Error("Village not found.");
  }

  const fullName = `${firstName} ${lastName}`;
  const verifiedAt = isCitizenVerified ? new Date() : null;

  await prisma.$transaction(async (tx) => {
    const house = await tx.house.upsert({
      where: {
        villageId_houseNumber: {
          villageId,
          houseNumber,
        },
      },
      update: {
        address,
      },
      create: {
        villageId,
        houseNumber,
        address,
      },
    });

    const existingUser = await tx.user.findUnique({
      where: { phoneNumber },
      select: { id: true },
    });

    let userId: string | null = existingUser?.id ?? null;

    if (createUserAccount || existingUser) {
      const user = existingUser
        ? await tx.user.update({
            where: { phoneNumber },
            data: {
              name: fullName,
              email,
              phoneNumberVerified: true,
              registrationProvince: village.province,
              registrationDistrict: village.district,
              registrationSubdistrict: village.subdistrict,
              registrationVillageId: villageId,
              citizenVerifiedAt: verifiedAt,
              consentAt: verifiedAt ?? undefined,
            },
            select: { id: true },
          })
        : await tx.user.create({
            data: {
              phoneNumber,
              phoneNumberVerified: true,
              name: fullName,
              email,
              registrationProvince: village.province,
              registrationDistrict: village.district,
              registrationSubdistrict: village.subdistrict,
              registrationVillageId: villageId,
              citizenVerifiedAt: verifiedAt,
              consentAt: verifiedAt,
            },
            select: { id: true },
          });

      userId = user.id;

      await tx.villageMembership.upsert({
        where: {
          userId_villageId: {
            userId,
            villageId,
          },
        },
        update: {
          role: VillageMembershipRole.RESIDENT,
          status: MembershipStatus.ACTIVE,
          houseId: house.id,
          joinedAt: new Date(),
        },
        create: {
          userId,
          villageId,
          role: VillageMembershipRole.RESIDENT,
          status: MembershipStatus.ACTIVE,
          houseId: house.id,
          joinedAt: new Date(),
        },
      });
    }

    const existingPerson = await tx.person.findFirst({
      where: {
        OR: [
          { phone: phoneNumber },
          nationalId ? { nationalId } : undefined,
        ].filter(Boolean) as Array<{ phone?: string; nationalId?: string }>,
      },
      select: { id: true },
    });

    if (existingPerson) {
      await tx.person.update({
        where: { id: existingPerson.id },
        data: {
          villageId,
          houseId: house.id,
          nationalId,
          firstName,
          lastName,
          dateOfBirth,
          gender,
          phone: phoneNumber,
          email,
        },
      });
    } else {
      await tx.person.create({
        data: {
          villageId,
          houseId: house.id,
          nationalId,
          firstName,
          lastName,
          dateOfBirth,
          gender,
          phone: phoneNumber,
          email,
        },
      });
    }

    await tx.phoneRoleSeed.upsert({
      where: { phoneNumber },
      update: {
        villageId,
        membershipRole: VillageMembershipRole.RESIDENT,
        systemRole: null,
        isCitizenVerified,
        note:
          note ??
          `Imported resident seed: ${fullName} / house ${houseNumber}`,
      },
      create: {
        phoneNumber,
        villageId,
        membershipRole: VillageMembershipRole.RESIDENT,
        isCitizenVerified,
        note:
          note ??
          `Imported resident seed: ${fullName} / house ${houseNumber}`,
      },
    });
  });

  revalidatePath("/dev");
}

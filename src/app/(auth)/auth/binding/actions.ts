"use server";

import { BindingRequestStatus, MembershipStatus, VillageMembershipRole, NotificationType } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

function toOptionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function submitBindingRequestAction(formData: FormData) {
  const session = await getSessionContextFromServerCookies();
  if (!session) {
    if (process.env.NODE_ENV === "development") {
      const cookieStore = await cookies();
      console.log("[binding] no session; cookies:", cookieStore.getAll());
    }
    redirect("/auth/login");
  }

  const villageId = toOptionalString(formData.get("villageId"));
  const houseNumber = toOptionalString(formData.get("houseNumber"));
  const note = toOptionalString(formData.get("note"));

  if (!villageId) {
    throw new Error("Village is required.");
  }

  const existingPending = await prisma.bindingRequest.findFirst({
    where: {
      userId: session.id,
      status: BindingRequestStatus.PENDING,
    },
    select: { id: true, villageId: true },
  });

  if (existingPending) {
    await prisma.bindingRequest.update({
      where: { id: existingPending.id },
      data: {
        // Keep original village while request is pending to avoid duplicate multi-village requests.
        houseNumber,
        note,
      },
    });

    await prisma.villageMembership.upsert({
      where: {
        userId_villageId: {
          userId: session.id,
          villageId: existingPending.villageId ?? villageId,
        },
      },
      update: {
        role: VillageMembershipRole.RESIDENT,
        status: MembershipStatus.PENDING,
      },
      create: {
        userId: session.id,
        villageId: existingPending.villageId ?? villageId,
        role: VillageMembershipRole.RESIDENT,
        status: MembershipStatus.PENDING,
      },
    });

    revalidatePath("/auth/binding");
    revalidatePath("/auth/binding/pending");
    redirect("/auth/binding/pending");
  } else {
    const createdBinding = await prisma.bindingRequest.create({
      data: {
        userId: session.id,
        villageId,
        houseNumber,
        note,
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
            title: "New Resident Binding Request",
            body: `${createdBinding.user.name} (${createdBinding.user.phoneNumber}) requested to bind account to village`,
            metadata: { bindingRequestId: createdBinding.id },
          })),
        });
      }
    }
  }

  await prisma.villageMembership.upsert({
    where: {
      userId_villageId: {
        userId: session.id,
        villageId,
      },
    },
    update: {
      role: VillageMembershipRole.RESIDENT,
      status: MembershipStatus.PENDING,
    },
    create: {
      userId: session.id,
      villageId,
      role: VillageMembershipRole.RESIDENT,
      status: MembershipStatus.PENDING,
    },
  });

  revalidatePath("/auth/binding");
  revalidatePath("/auth/binding/pending");
  redirect("/auth/binding/pending");
}


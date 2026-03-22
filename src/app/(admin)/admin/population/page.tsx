"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { BindingRequestStatus, MembershipStatus, NotificationType, Prisma, SystemRole, VillageMembershipRole } from "@prisma/client";
import { getSessionContextFromServerCookies, isAdminUser, computeLandingPath } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

const ADMIN_MEMBERSHIP_ROLES: Set<VillageMembershipRole> = new Set([
  VillageMembershipRole.HEADMAN,
  VillageMembershipRole.ASSISTANT_HEADMAN,
  VillageMembershipRole.COMMITTEE,
]);

type PendingBindingRequest = {
  id: string;
  houseNumber: string | null;
  note: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    phoneNumber: string;
  };
  village: {
    name: string | null;
  } | null;
};

function splitDisplayName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: "ไม่ระบุ", lastName: "-" };
  }

  const parts = trimmed.split(/\s+/);
  const firstName = parts[0] ?? "ไม่ระบุ";
  const lastName = parts.slice(1).join(" ") || "-";
  return { firstName, lastName };
}

async function getPendingBindingRequests(
  isSuperAdmin: boolean,
  villageIds: string[]
) {
  if (!isSuperAdmin && villageIds.length === 0) {
    return [] as PendingBindingRequest[];
  }

  const where: Prisma.BindingRequestWhereInput = {
    status: BindingRequestStatus.PENDING,
  };
  if (!isSuperAdmin) {
    where.villageId = { in: villageIds };
  }

  return prisma.bindingRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    distinct: ["userId"],
    include: {
      user: {
        select: {
          id: true,
          name: true,
          phoneNumber: true,
        },
      },
      village: {
        select: {
          name: true,
        },
      },
    },
  });
}

export async function handleBindingRequestAction(formData: FormData) {
  const session = await getSessionContextFromServerCookies();
  if (!session) {
    redirect("/auth/login?callbackUrl=/admin/population");
  }

  if (!isAdminUser(session)) {
    redirect(computeLandingPath(session));
  }

  const requestId = formData.get("requestId");
  const action = formData.get("action");
  const reviewNote = (formData.get("reviewNote") ?? "").toString().trim();

  if (!requestId || typeof requestId !== "string") {
    throw new Error("Missing requestId");
  }
  if (!action || (action !== "approve" && action !== "reject")) {
    throw new Error("Invalid action");
  }

  const binding = await prisma.bindingRequest.findUnique({
    where: { id: requestId },
  });
  if (!binding) {
    throw new Error("Binding request not found");
  }
  if (!binding.villageId) {
    throw new Error("Binding request is missing village information");
  }

  const canManage =
    session.systemRole === SystemRole.SUPERADMIN ||
    session.memberships.some(
      (membership) =>
        ADMIN_MEMBERSHIP_ROLES.has(membership.role) &&
        membership.villageId === binding.villageId
    );
  if (!canManage) {
    throw new Error("Unauthorized");
  }

  const now = new Date();
  const status = action === "approve" ? BindingRequestStatus.APPROVED : BindingRequestStatus.REJECTED;
  const membershipStatus = action === "approve" ? MembershipStatus.ACTIVE : MembershipStatus.REJECTED;

  await prisma.$transaction(async (tx) => {
    let resolvedHouseId: string | null = null;

    if (action === "approve") {
      if (binding.houseId) {
        resolvedHouseId = binding.houseId;
      } else if (binding.houseNumber) {
        const house = await tx.house.upsert({
          where: {
            villageId_houseNumber: {
              villageId: binding.villageId!,
              houseNumber: binding.houseNumber,
            },
          },
          update: {},
          create: {
            villageId: binding.villageId!,
            houseNumber: binding.houseNumber,
          },
          select: { id: true },
        });
        resolvedHouseId = house.id;
      }
    }

    await tx.bindingRequest.update({
      where: { id: requestId },
      data: {
        status,
        houseId: action === "approve" ? resolvedHouseId : null,
        reviewedBy: session.id,
        reviewedAt: now,
        reviewNote: reviewNote || null,
      },
    });

    await tx.villageMembership.upsert({
      where: {
        userId_villageId: {
          userId: binding.userId,
          villageId: binding.villageId!,
        },
      },
      update: {
        status: membershipStatus,
        houseId: action === "approve" ? resolvedHouseId : null,
        joinedAt: membershipStatus === MembershipStatus.ACTIVE ? now : null,
      },
      create: {
        userId: binding.userId,
        villageId: binding.villageId!,
        role: VillageMembershipRole.RESIDENT,
        status: membershipStatus,
        houseId: action === "approve" ? resolvedHouseId : null,
        joinedAt: membershipStatus === MembershipStatus.ACTIVE ? now : null,
      },
    });

    if (action === "approve") {
      await tx.user.update({
        where: { id: binding.userId },
        data: {
          citizenVerifiedAt: now,
        },
      });

      if (resolvedHouseId) {
        const residentUser = await tx.user.findUnique({
          where: { id: binding.userId },
          select: {
            name: true,
            phoneNumber: true,
          },
        });

        if (residentUser) {
          const names = splitDisplayName(residentUser.name);
          const existingPerson = await tx.person.findFirst({
            where: {
              phone: residentUser.phoneNumber,
            },
            select: { id: true },
          });

          if (existingPerson) {
            await tx.person.update({
              where: { id: existingPerson.id },
              data: {
                villageId: binding.villageId,
                houseId: resolvedHouseId,
              },
            });
          } else {
            await tx.person.create({
              data: {
                villageId: binding.villageId,
                houseId: resolvedHouseId,
                firstName: names.firstName,
                lastName: names.lastName,
                phone: residentUser.phoneNumber,
              },
            });
          }
        }
      }

      // Notify resident of approval with action link
      await tx.notification.create({
        data: {
          userId: binding.userId,
          villageId: binding.villageId,
          type: NotificationType.BINDING_REQUEST,
          title: "การผูกบัญชีได้รับการอนุมัติแล้ว",
          body: "ยินดีด้วย! การผูกบัญชีของคุณได้รับการอนุมัติ คุณสามารถเข้าสู่ระบบและใช้งานโปรแกรมได้แล้ว",
          metadata: { 
            bindingRequestId: requestId, 
            action: "approved",
            actionUrl: "/resident/dashboard",
            actionLabel: "ไปไปที่หน้าแรก"
          },
        },
      });
    } else {
      // Notify resident of rejection
      await tx.notification.create({
        data: {
          userId: binding.userId,
          villageId: binding.villageId,
          type: NotificationType.BINDING_REQUEST,
          title: "การผูกบัญชีถูกปฏิเสธ",
          body: reviewNote ? `การผูกบัญชีของคุณถูกปฏิเสธ เหตุผล: ${reviewNote}` : "การผูกบัญชีของคุณถูกปฏิเสธ",
          metadata: { bindingRequestId: requestId, action: "rejected", reason: reviewNote },
        },
      });
    }
  });

  revalidatePath("/admin/population");
}

export async function revertOrUpdateBindingAction(formData: FormData) {
  const session = await getSessionContextFromServerCookies();
  if (!session) {
    redirect("/auth/login?callbackUrl=/admin/population");
  }

  if (!isAdminUser(session)) {
    redirect(computeLandingPath(session));
  }

  const requestId = formData.get("requestId");
  const actionType = formData.get("actionType");
  const newStatus = (formData.get("newStatus") ?? "").toString().trim();
  const reviewNote = (formData.get("reviewNote") ?? "").toString().trim();

  if (!requestId || typeof requestId !== "string") {
    throw new Error("Missing requestId");
  }

  const binding = await prisma.bindingRequest.findUnique({
    where: { id: requestId },
    include: { user: true },
  });

  if (!binding) {
    throw new Error("Binding request not found");
  }

  if (!binding.villageId) {
    throw new Error("Binding request is missing village information");
  }

  const canManage =
    session.systemRole === SystemRole.SUPERADMIN ||
    session.memberships.some(
      (membership) =>
        ADMIN_MEMBERSHIP_ROLES.has(membership.role) &&
        membership.villageId === binding.villageId
    );

  if (!canManage) {
    throw new Error("Unauthorized");
  }

  const now = new Date();

  // Handle revert to PENDING
  if (actionType === "revert_to_pending") {
    await prisma.$transaction(async (tx) => {
      await tx.bindingRequest.update({
        where: { id: requestId },
        data: {
          status: BindingRequestStatus.PENDING,
          reviewedBy: null,
          reviewedAt: null,
          reviewNote: null,
        },
      });

      await tx.villageMembership.upsert({
        where: {
          userId_villageId: {
            userId: binding.userId,
            villageId: binding.villageId!,
          },
        },
        update: {
          status: MembershipStatus.PENDING,
          houseId: null,
          joinedAt: null,
        },
        create: {
          userId: binding.userId,
          villageId: binding.villageId!,
          role: VillageMembershipRole.RESIDENT,
          status: MembershipStatus.PENDING,
          houseId: null,
        },
      });

      // Clear citizen verification if approval was reverted
      if (binding.status === BindingRequestStatus.APPROVED) {
        await tx.user.update({
          where: { id: binding.userId },
          data: { citizenVerifiedAt: null },
        });
      }

      // Notify resident that decision was reverted
      await tx.notification.create({
        data: {
          userId: binding.userId,
          villageId: binding.villageId,
          type: NotificationType.BINDING_REQUEST,
          title: "การผูกบัญชีได้ถูกยกเลิกการตัดสินใจ",
          body: "การตัดสินใจของการผูกบัญชีนของคุณได้ถูกยกเลิก โปรดรอการพิจารณาใหม่",
          metadata: { bindingRequestId: requestId, action: "reverted" },
        },
      });
    });
  }
  // Handle change from APPROVED to REJECTED or vice versa
  else if (actionType === "change_decision" && newStatus) {
    if (!["APPROVED", "REJECTED"].includes(newStatus)) {
      throw new Error("Invalid new status");
    }

    const membershipStatus = newStatus === "APPROVED" ? MembershipStatus.ACTIVE : MembershipStatus.REJECTED;

    await prisma.$transaction(async (tx) => {
      let resolvedHouseId: string | null = null;

      if (newStatus === "APPROVED") {
        if (binding.houseId) {
          resolvedHouseId = binding.houseId;
        } else if (binding.houseNumber) {
          const house = await tx.house.upsert({
            where: {
              villageId_houseNumber: {
                villageId: binding.villageId!,
                houseNumber: binding.houseNumber,
              },
            },
            update: {},
            create: {
              villageId: binding.villageId!,
              houseNumber: binding.houseNumber,
            },
            select: { id: true },
          });
          resolvedHouseId = house.id;
        }
      }

      await tx.bindingRequest.update({
        where: { id: requestId },
        data: {
          status: newStatus as BindingRequestStatus,
          houseId: newStatus === "APPROVED" ? resolvedHouseId : null,
          reviewedBy: session.id,
          reviewedAt: now,
          reviewNote: reviewNote || null,
        },
      });

      await tx.villageMembership.update({
        where: {
          userId_villageId: {
            userId: binding.userId,
            villageId: binding.villageId!,
          },
        },
        data: {
          status: membershipStatus,
          houseId: newStatus === "APPROVED" ? resolvedHouseId : null,
          joinedAt: membershipStatus === MembershipStatus.ACTIVE ? now : null,
        },
      });

      if (newStatus === "APPROVED") {
        await tx.user.update({
          where: { id: binding.userId },
          data: { citizenVerifiedAt: now },
        });

        if (resolvedHouseId) {
          const residentUser = await tx.user.findUnique({
            where: { id: binding.userId },
            select: {
              name: true,
              phoneNumber: true,
            },
          });

          if (residentUser) {
            const names = splitDisplayName(residentUser.name);
            const existingPerson = await tx.person.findFirst({
              where: {
                phone: residentUser.phoneNumber,
              },
              select: { id: true },
            });

            if (existingPerson) {
              await tx.person.update({
                where: { id: existingPerson.id },
                data: {
                  villageId: binding.villageId,
                  houseId: resolvedHouseId,
                },
              });
            } else {
              await tx.person.create({
                data: {
                  villageId: binding.villageId,
                  houseId: resolvedHouseId,
                  firstName: names.firstName,
                  lastName: names.lastName,
                  phone: residentUser.phoneNumber,
                },
              });
            }
          }
        }
      } else {
        await tx.user.update({
          where: { id: binding.userId },
          data: { citizenVerifiedAt: null },
        });
      }

      // Notify resident of decision change
      const title = newStatus === "APPROVED" ? "การผูกบัญชีได้รับการอนุมัติแล้ว" : "การผูกบัญชีถูกปฏิเสธ";
      let body = "";
      const metadata: any = { bindingRequestId: requestId, action: newStatus.toLowerCase() };
      
      if (newStatus === "APPROVED") {
        body = "ยินดีด้วย! การผูกบัญชีของคุณได้รับการอนุมัติ คุณสามารถเข้าสู่ระบบและใช้งานโปรแกรมได้แล้ว";
        metadata.actionUrl = "/resident/dashboard";
        metadata.actionLabel = "ไปไปที่หน้าแรก";
      } else {
        body = reviewNote
          ? `การผูกบัญชีของคุณถูกปฏิเสธ เหตุผล: ${reviewNote}`
          : "การผูกบัญชีของคุณถูกปฏิเสธ";
        metadata.reason = reviewNote;
      }

      await tx.notification.create({
        data: {
          userId: binding.userId,
          villageId: binding.villageId,
          type: NotificationType.BINDING_REQUEST,
          title,
          body,
          metadata,
        },
      });
    });
  }

  revalidatePath("/admin/population");
}

export default async function Page() {
  const session = await getSessionContextFromServerCookies();
  if (!session) {
    redirect("/auth/login?callbackUrl=/admin/population");
  }

  if (!isAdminUser(session)) {
    redirect(computeLandingPath(session));
  }

  const villageIds = session.memberships
    .filter((m) => ADMIN_MEMBERSHIP_ROLES.has(m.role))
    .map((m) => m.villageId);

  const pendingRequests = await getPendingBindingRequests(
    session.systemRole === SystemRole.SUPERADMIN,
    villageIds
  );

  const historyRequests = await getBindingRequestHistory(
    session.systemRole === SystemRole.SUPERADMIN,
    villageIds
  );

  const reviewerIds = historyRequests
    .map((req) => req.reviewedBy)
    .filter((id): id is string => Boolean(id));

  const reviewers = reviewerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: reviewerIds } },
        select: { id: true, name: true },
      })
    : [];

  const reviewerMap = reviewers.reduce<Record<string, string>>((acc, user) => {
    acc[user.id] = user.name;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ทะเบียนครัวเรือน</h1>
        <p className="text-gray-500 text-sm mt-1">
          รายการคำร้องผูกบ้านและประวัติการอนุมัติ
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">คำร้องรอยืนยัน</h2>
        {pendingRequests.length === 0 ? (
          <p className="text-gray-500 text-sm text-center">ไม่มีคำร้องรอยืนยันในตอนนี้</p>
        ) : (
          <div className="space-y-6">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="rounded-xl border border-gray-100 bg-gray-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {request.user.name || request.user.phoneNumber}
                    </div>
                    <div className="text-xs text-gray-500">{request.user.phoneNumber}</div>
                  </div>
                  <div className="text-xs text-gray-500">
                    ส่งคำร้องเมื่อ {new Date(request.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <div className="text-xs text-gray-500">หมู่บ้าน</div>
                    <div className="text-sm font-medium text-gray-900">
                      {request.village?.name ?? "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">บ้านเลขที่</div>
                    <div className="text-sm font-medium text-gray-900">
                      {request.houseNumber ?? "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">หมายเหตุ</div>
                    <div className="text-sm text-gray-900">{request.note ?? "-"}</div>
                  </div>
                </div>

                <form action={handleBindingRequestAction} className="mt-4 space-y-2">
                  <input type="hidden" name="requestId" value={request.id} />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <textarea
                      name="reviewNote"
                      placeholder="หมายเหตุการอนุมัติ/ปฏิเสธ (ไม่บังคับ)"
                      className="col-span-1 md:col-span-2 w-full rounded-lg border border-gray-200 p-2 text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        name="action"
                        value="approve"
                        type="submit"
                        className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                      >
                        อนุมัติ
                      </button>
                      <button
                        name="action"
                        value="reject"
                        type="submit"
                        className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                      >
                        ปฏิเสธ
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">ประวัติการอนุมัติ/ปฏิเสธ</h2>
        {historyRequests.length === 0 ? (
          <p className="text-gray-500 text-sm text-center">ยังไม่มีประวัติการอนุมัติหรือปฏิเสธ</p>
        ) : (
          <div className="space-y-4">
            {historyRequests.map((request) => (
              <div key={request.id} className="rounded-xl border border-gray-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-gray-500">ผู้ร้องไห้</div>
                    <div className="text-sm font-medium text-gray-900">
                      {request.user.name || request.user.phoneNumber}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">หมู่บ้าน</div>
                    <div className="text-sm text-gray-700">{request.village?.name ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">บ้านเลขที่</div>
                    <div className="text-sm text-gray-700">{request.houseNumber ?? "-"}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-gray-500">สถานะ</div>
                    <div
                      className={`text-sm font-semibold ${request.status === BindingRequestStatus.APPROVED ? "text-green-700" : "text-red-700"}`}
                    >
                      {request.status}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">ผู้ตรวจสอบ</div>
                    <div className="text-sm text-gray-700">
                      {request.reviewedBy ? reviewerMap[request.reviewedBy] || "-" : "-"}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-xs text-gray-500">เวลา</div>
                    <div className="text-sm text-gray-700">
                      {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : "-"}
                    </div>
                  </div>
                </div>

                {request.reviewNote && (
                  <div className="mb-4 p-2 bg-gray-50 rounded text-sm text-gray-700">
                    <div className="text-xs text-gray-500 mb-1">หมายเหตุ:</div>
                    {request.reviewNote}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  <form action={revertOrUpdateBindingAction} style={{ display: "contents" }}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="actionType" value="revert_to_pending" />
                    <button
                      type="submit"
                      className="px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                    >
                      ยกเลิกการตัดสินใจ
                    </button>
                  </form>

                  {request.status === BindingRequestStatus.APPROVED && (
                    <form action={revertOrUpdateBindingAction} style={{ display: "contents" }}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="actionType" value="change_decision" />
                      <input type="hidden" name="newStatus" value="REJECTED" />
                      <button
                        type="submit"
                        className="px-3 py-1 text-xs font-medium bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        เปลี่ยนเป็นปฏิเสธ
                      </button>
                    </form>
                  )}

                  {request.status === BindingRequestStatus.REJECTED && (
                    <form action={revertOrUpdateBindingAction} style={{ display: "contents" }}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="actionType" value="change_decision" />
                      <input type="hidden" name="newStatus" value="APPROVED" />
                      <button
                        type="submit"
                        className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        เปลี่ยนเป็นอนุมัติ
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

async function getBindingRequestHistory(isSuperAdmin: boolean, villageIds: string[]) {
  if (!isSuperAdmin && villageIds.length === 0) {
    return [] as Array<{
      id: string;
      houseNumber: string | null;
      note: string | null;
      status: BindingRequestStatus;
      reviewedBy: string | null;
      reviewedAt: Date | null;
      reviewNote: string | null;
      user: { name: string; phoneNumber: string };
      village: { name: string | null } | null;
    }>;
  }

  const where: Prisma.BindingRequestWhereInput = {
    status: { in: [BindingRequestStatus.APPROVED, BindingRequestStatus.REJECTED] },
  };
  if (!isSuperAdmin) {
    where.villageId = { in: villageIds };
  }

  return prisma.bindingRequest.findMany({
    where,
    orderBy: { reviewedAt: "desc" },
    distinct: ["userId"],
    include: {
      user: { select: { name: true, phoneNumber: true } },
      village: { select: { name: true } },
    },
  });
}

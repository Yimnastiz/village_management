import { MembershipStatus, NotificationType, Prisma, VillageMembershipRole } from "@prisma/client";

/**
 * The single notification boundary for a Super Admin acting in a village
 * workspace. Call it once for the user-facing operation, inside the same
 * transaction as the mutation and its audit record whenever possible.
 */
export async function notifyVillageAdministrationOfSuperAdminIntervention(
  tx: Prisma.TransactionClient,
  input: {
    villageId: string;
    actionLabel: string;
    supportReason: string;
    targetType: string;
    targetId?: string | null;
    targetName?: string | null;
    actionUrl: string;
    metadata?: Prisma.InputJsonObject;
  },
) {
  const recipients = await tx.villageMembership.findMany({
    where: {
      villageId: input.villageId,
      status: MembershipStatus.ACTIVE,
      role: { in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN] },
    },
    select: { userId: true },
  });
  const userIds = [...new Set(recipients.map((recipient) => recipient.userId))];
  if (userIds.length === 0) return;

  const reason = input.supportReason.trim();
  const target = input.targetName?.trim();
  const body = `ผู้ดูแลระบบระดับสูง${input.actionLabel}${target ? ` ${target}` : ""}\nเหตุผล: ${reason}`;

  await tx.notification.createMany({
    data: userIds.map((userId) => ({
      villageId: input.villageId,
      userId,
      type: NotificationType.SYSTEM,
      title: "ผู้ดูแลระบบระดับสูงดำเนินการแทนหมู่บ้าน",
      body,
      metadata: {
        source: "SUPERADMIN_INTERVENTION",
        actorRole: "SUPERADMIN",
        actorLabel: "ผู้ดูแลระบบระดับสูง",
        actionLabel: input.actionLabel,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        supportReason: reason,
        actionUrl: input.actionUrl,
        ...input.metadata,
      },
    })),
  });
}

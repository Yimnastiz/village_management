import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { BroadcastForm } from "./broadcast-form";

export default async function SuperAdminBroadcastsPage() {
  await requireSuperAdminPageSession();
  const now = new Date();

  const rawNotifications = await prisma.notification.findMany({
    where: {
      type: "SYSTEM",
      status: { in: ["UNREAD", "READ"] },
      metadata: {
        path: ["source"],
        equals: "SUPERADMIN_BROADCAST",
      },
    },
    orderBy: { createdAt: "desc" },
    take: 600,
    select: {
      id: true,
      title: true,
      body: true,
      metadata: true,
      createdAt: true,
      userId: true,
    },
  });

  const grouped = new Map<string, {
    groupId: string;
    title: string;
    body: string;
    expiresAt: string | null;
    createdAtIso: string;
    audienceCount: number;
    active: boolean;
  }>();

  for (const notification of rawNotifications) {
    const metadata = notification.metadata as Record<string, unknown> | null;
    const source = typeof metadata?.source === "string" ? metadata.source : "";
    const groupId = typeof metadata?.broadcastGroupId === "string" ? metadata.broadcastGroupId : "";
    const expiresAtRaw = typeof metadata?.expiresAt === "string" ? metadata.expiresAt : null;
    if (source !== "SUPERADMIN_BROADCAST" || !groupId) {
      continue;
    }

    const expiresAtDate = expiresAtRaw ? new Date(expiresAtRaw) : null;
    const active = !expiresAtDate || expiresAtDate > now;
    const existing = grouped.get(groupId);

    if (!existing) {
      grouped.set(groupId, {
        groupId,
        title: notification.title,
        body: notification.body ?? "",
        expiresAt: expiresAtRaw,
        createdAtIso: notification.createdAt.toISOString(),
        audienceCount: 1,
        active,
      });
      continue;
    }

    existing.audienceCount += 1;
    if (notification.createdAt.toISOString() > existing.createdAtIso) {
      existing.createdAtIso = notification.createdAt.toISOString();
      existing.title = notification.title;
      existing.body = notification.body ?? "";
      existing.expiresAt = expiresAtRaw;
      existing.active = active;
    }
  }

  const broadcasts = Array.from(grouped.values()).sort(
    (left, right) => new Date(right.createdAtIso).getTime() - new Date(left.createdAtIso).getTime()
  );

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">จัดการประกาศส่วนกลาง</h2>
        <BroadcastForm broadcasts={broadcasts} />
      </section>
    </div>
  );
}

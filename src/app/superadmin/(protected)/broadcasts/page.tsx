import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { BroadcastForm } from "./broadcast-form";

export default async function SuperAdminBroadcastsPage() {
  await requireSuperAdminPageSession();
  const now = new Date();
  // There is no Broadcast entity yet. Reading every row avoids the former 600-row window
  // splitting a broadcast group and reporting a false recipient count.
  const notifications = await prisma.notification.findMany({ where: { type: "SYSTEM", metadata: { path: ["source"], equals: "SUPERADMIN_BROADCAST" } }, orderBy: { createdAt: "desc" }, select: { title: true, body: true, metadata: true, createdAt: true, status: true, userId: true } });
  const grouped = new Map<string, { groupId: string; title: string; body: string; expiresAt: string | null; createdAtIso: string; recipientIds: Set<string>; status: "ACTIVE" | "EXPIRED" | "ARCHIVED" }>();
  for (const notification of notifications) {
    const metadata = notification.metadata as Record<string, unknown> | null;
    const groupId = typeof metadata?.broadcastGroupId === "string" ? metadata.broadcastGroupId : "";
    if (!groupId) continue;
    const expiresAt = typeof metadata?.expiresAt === "string" ? metadata.expiresAt : null;
    const status = notification.status === "ARCHIVED" ? "ARCHIVED" : expiresAt && new Date(expiresAt) <= now ? "EXPIRED" : "ACTIVE";
    const existing = grouped.get(groupId);
    if (!existing) grouped.set(groupId, { groupId, title: notification.title, body: notification.body ?? "", expiresAt, createdAtIso: notification.createdAt.toISOString(), recipientIds: new Set([notification.userId]), status });
    else {
      existing.recipientIds.add(notification.userId);
      if (notification.createdAt.toISOString() > existing.createdAtIso) Object.assign(existing, { title: notification.title, body: notification.body ?? "", expiresAt, createdAtIso: notification.createdAt.toISOString(), status });
    }
  }
  const broadcasts = Array.from(grouped.values()).map(({ recipientIds, ...broadcast }) => ({ ...broadcast, audienceCount: recipientIds.size })).sort((a, b) => new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime());
  return <BroadcastForm broadcasts={broadcasts} />;
}

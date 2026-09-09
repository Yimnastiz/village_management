import { prisma } from "@/lib/prisma";
import { BROADCAST_SOURCES } from "@/features/broadcasts/server/broadcast-service";

export type SystemBroadcastTickerItem = {
  id: string;
  title: string;
  body: string | null;
  createdAt: string;
  expiresAt: string | null;
  href: string;
  isUnread: boolean;
};

function previewBody(body: string | null) {
  if (!body) return null;
  const normalized = body.replace(/\s+/g, " ").trim();
  return normalized.length > 140 ? `${normalized.slice(0, 137)}…` : normalized;
}

export async function getActiveSystemBroadcastTickerItems(userId: string, audience: "admin" | "resident") {
  const now = new Date();
  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      type: "SYSTEM",
      status: { in: ["UNREAD", "READ"] },
      OR: BROADCAST_SOURCES.map((source) => ({ metadata: { path: ["source"], equals: source } })),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, title: true, body: true, status: true, createdAt: true, metadata: true },
  });

  return notifications
    .filter((notification) => {
      const metadata = notification.metadata as Record<string, unknown> | null;
      const expiresAt = typeof metadata?.expiresAt === "string" ? new Date(metadata.expiresAt) : null;
      return !expiresAt || expiresAt > now;
    })
    .slice(0, 5)
    .map((notification) => ({
      id: notification.id,
      title: notification.title,
      body: previewBody(notification.body),
      createdAt: notification.createdAt.toISOString(),
      expiresAt: null,
      href: `/${audience}/notifications/${notification.id}`,
      isUnread: notification.status === "UNREAD",
    }));
}

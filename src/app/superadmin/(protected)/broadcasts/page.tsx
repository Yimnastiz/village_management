import { Prisma } from "@prisma/client";
import { QueryPagination } from "@/components/ui/query-pagination";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { BroadcastForm } from "./broadcast-form";

type PageProps = { searchParams?: Promise<{ q?: string; status?: string; page?: string }> };
const PAGE_SIZE = 15;

export default async function SuperAdminBroadcastsPage({ searchParams }: PageProps) {
  await requireSuperAdminPageSession();
  const params = (await searchParams) ?? {}; const q = (params.q ?? "").trim(); const selectedStatus = params.status === "active" || params.status === "expired" || params.status === "cancelled" ? params.status : "all";
  const page = Math.max(1, Number(params.page ?? "1") || 1); const now = new Date();
  const where: Prisma.SystemBroadcastWhereInput = {
    AND: [
      ...(q ? [{ OR: [{ title: { contains: q, mode: "insensitive" as const } }, { body: { contains: q, mode: "insensitive" as const } }] }] : []),
      ...(selectedStatus === "active" ? [{ status: "ACTIVE" as const, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] : []),
      ...(selectedStatus === "expired" ? [{ status: "ACTIVE" as const, expiresAt: { lte: now } }] : []),
      ...(selectedStatus === "cancelled" ? [{ status: "CANCELLED" as const }] : []),
    ],
  };
  const [rows, total] = await Promise.all([
    prisma.systemBroadcast.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { createdBy: { select: { name: true } } } }),
    prisma.systemBroadcast.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const broadcasts = rows.map((row) => ({ groupId: row.id, title: row.title, body: row.body, expiresAt: row.expiresAt?.toISOString() ?? null, createdAtIso: row.createdAt.toISOString(), audienceCount: row.audienceCount, createdByName: row.createdBy?.name ?? null, status: row.status === "CANCELLED" ? "ARCHIVED" as const : row.expiresAt && row.expiresAt <= now ? "EXPIRED" as const : "ACTIVE" as const }));
  return <div className="-mt-4 space-y-4 sm:-mt-6"><BroadcastForm broadcasts={broadcasts} keyword={q} status={selectedStatus} total={total} />{totalPages > 1 ? <QueryPagination pathname="/superadmin/broadcasts" page={page} totalPages={totalPages} params={{ q: q || undefined, status: selectedStatus === "all" ? undefined : selectedStatus }} /> : null}</div>;
}

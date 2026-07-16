import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

function reasonFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || !("reason" in metadata)) return null;
  const reason = (metadata as { reason?: unknown }).reason;
  return typeof reason === "string" ? reason : null;
}

export default async function VillageAuditPage({ params }: { params: Promise<{ villageId: string }> }) {
  await requireSuperAdminPageSession(); const { villageId } = await params;
  const logs = await prisma.auditLog.findMany({ where: { villageId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, action: true, resource: true, resourceId: true, metadata: true, createdAt: true, user: { select: { name: true, systemRole: true } } } });
  return <section className="rounded-xl border bg-white p-4"><h2 className="text-lg font-semibold">Audit Log ของหมู่บ้าน</h2><div className="mt-3 grid gap-2">{logs.map((log) => <div key={log.id} className="rounded-lg border p-3 text-sm"><p className="font-medium">{log.action} · {log.resource} · {log.user?.name ?? "ระบบ"}</p><p className="text-slate-500">{log.user?.systemRole ?? "SYSTEM"} · {log.createdAt.toLocaleString("th-TH")} · Resource {log.resourceId ?? "-"}</p>{reasonFromMetadata(log.metadata) ? <p className="mt-1 text-xs text-amber-700">เหตุผล: {reasonFromMetadata(log.metadata)}</p> : null}</div>)}</div></section>;
}

import { AuditAction } from "@prisma/client";
import { NextResponse } from "next/server";
import { buildVillagePopulationWorkbook, parsePopulationExportOptions } from "@/features/population/server/population-export";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminRequestSession } from "@/lib/superadmin";
import { notifyVillageAdministrationOfSuperAdminIntervention } from "@/lib/superadmin-village-intervention";

export async function GET(request: Request, { params }: { params: Promise<{ villageId: string }> }) {
  const actor = await requireSuperAdminRequestSession(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { villageId } = await params;
  const village = await prisma.village.findUnique({ where: { id: villageId }, select: { id: true } });
  if (!village) return NextResponse.json({ error: "Village not found" }, { status: 404 });
  const url = new URL(request.url);
  const supportReason = url.searchParams.get("supportReason")?.trim() ?? "";
  if (supportReason.length < 5 || supportReason.length > 500) return NextResponse.json({ error: "กรุณาระบุเหตุผลในการดำเนินการ 5–500 ตัวอักษร" }, { status: 400 });
  const options = parsePopulationExportOptions(url, false);
  const result = await buildVillagePopulationWorkbook(villageId, options);
  await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({ data: { userId: actor.id, villageId, action: AuditAction.POPULATION_EXPORT_CREATED, resource: "PopulationExport", metadata: { actorRole: "SUPERADMIN", targetVillageId: villageId, supportReason, ...options, counts: result.counts } } });
    await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId, actionLabel: "ส่งออกข้อมูลทะเบียนประชากร", supportReason, targetType: "PopulationExport", actionUrl: "/admin/population/people", metadata: { exportType: "population" } });
  });
  return new NextResponse(result.buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="population-export-${new Date().toISOString().slice(0, 10)}.xlsx"`, "Cache-Control": "no-store" } });
}

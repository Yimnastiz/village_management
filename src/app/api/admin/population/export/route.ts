import { AuditAction } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAdminMembership, getSessionContextFromRequest, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { requireActionReason } from "@/lib/sensitive-action-policy";
import { hasVillagePermission } from "@/lib/village-permissions";
import { buildVillagePopulationWorkbook, parsePopulationExportOptions } from "@/features/population/server/population-export";

export async function GET(request: Request) {
  const session = await getSessionContextFromRequest(request);
  if (!session || !isAdminUser(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = getAdminMembership(session);
  if (!membership) return NextResponse.json({ error: "Village not found" }, { status: 404 });
  const url = new URL(request.url);
  const canExportSensitive = hasVillagePermission(membership.role, "population.export_sensitive");
  if (url.searchParams.get("masked") === "false" && !canExportSensitive) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const options = parsePopulationExportOptions(url, !canExportSensitive, !canExportSensitive);
  let reason = "";
  if (!options.masked) {
    if (!canExportSensitive) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    try { reason = requireActionReason("population.export_sensitive", url.searchParams.get("reason")); }
    catch { return NextResponse.json({ error: "Reason must contain at least 5 characters" }, { status: 400 }); }
  }
  const result = await buildVillagePopulationWorkbook(membership.villageId, options);
  await prisma.auditLog.create({ data: { userId: session.id, villageId: membership.villageId, action: AuditAction.POPULATION_EXPORT_CREATED, resource: "PopulationExport", metadata: { actorRole: membership.role, policyAction: options.masked ? null : "population.export_sensitive", reason: reason || null, villageId: membership.villageId, exportScope: options, counts: result.counts } } });
  return new NextResponse(result.buffer, { status: 200, headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="population-export-${new Date().toISOString().slice(0, 10)}.xlsx"`, "Cache-Control": "no-store" } });
}

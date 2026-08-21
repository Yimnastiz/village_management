import { AuditAction } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAdminMembership, getHeadmanMembership, getSessionContextFromRequest, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { buildVillagePopulationWorkbook, parsePopulationExportOptions } from "@/features/population/server/population-export";

export async function GET(request: Request) {
  const session = await getSessionContextFromRequest(request);
  if (!session || !isAdminUser(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = getAdminMembership(session);
  if (!membership) return NextResponse.json({ error: "Village not found" }, { status: 404 });
  const isHeadman = Boolean(getHeadmanMembership(session));
  const options = parsePopulationExportOptions(new URL(request.url), !isHeadman, !isHeadman);
  const result = await buildVillagePopulationWorkbook(membership.villageId, options);
  await prisma.auditLog.create({ data: { userId: session.id, villageId: membership.villageId, action: AuditAction.POPULATION_EXPORT_CREATED, resource: "PopulationExport", metadata: { actorRole: membership.role, villageId: membership.villageId, ...options, counts: result.counts } } });
  return new NextResponse(result.buffer, { status: 200, headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="population-export-${new Date().toISOString().slice(0, 10)}.xlsx"`, "Cache-Control": "no-store" } });
}

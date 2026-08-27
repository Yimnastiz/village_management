import { NextResponse } from "next/server";
import { getAdminMembership, getSessionContextFromRequest, isAdminUser } from "@/lib/access-control";
import { buildPopulationImportTemplateXlsx } from "@/features/population/server/import-template";
import { hasVillagePermission } from "@/lib/village-permissions";

export async function GET(request: Request) {
  const session = await getSessionContextFromRequest(request);

  if (!session || !isAdminUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const membership = getAdminMembership(session);
  if (!membership || !hasVillagePermission(membership.role, "population.import")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const xlsxBuffer = buildPopulationImportTemplateXlsx();
  const filename = "แบบฟอร์มนำเข้าข้อมูลประชากร.xlsx";
  const encodedFilename = encodeURIComponent(filename);

  return new NextResponse(new Uint8Array(xlsxBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="population-import-template.xlsx"; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "no-store",
    },
  });
}

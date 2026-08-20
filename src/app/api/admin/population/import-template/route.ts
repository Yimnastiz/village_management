import { NextResponse } from "next/server";
import { getSessionContextFromRequest, isAdminUser } from "@/lib/access-control";
import { buildPopulationImportTemplateXlsx } from "@/features/population/server/import-template";

export async function GET(request: Request) {
  const session = await getSessionContextFromRequest(request);

  if (!session || !isAdminUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const xlsxBuffer = buildPopulationImportTemplateXlsx();

  return new NextResponse(xlsxBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=utf-8",
      "Content-Disposition": 'attachment; filename="แบบฟอร์มนำเข้าข้อมูลประชากร.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}

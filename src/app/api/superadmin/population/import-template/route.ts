import { NextResponse } from "next/server";
import { buildPopulationImportTemplateXlsx } from "@/features/population/server/import-template";
import { requireSuperAdminRequestSession } from "@/lib/superadmin";

export async function GET(request: Request) {
  const session = await requireSuperAdminRequestSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const filename = "แบบฟอร์มนำเข้าข้อมูลประชากร.xlsx";
  return new NextResponse(new Uint8Array(buildPopulationImportTemplateXlsx()), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="population-import-template.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}

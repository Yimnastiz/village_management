import { NextResponse } from "next/server";
import { buildPopulationImportTemplateCsv } from "@/features/population/server/import-template";
import { requireSuperAdminRequestSession } from "@/lib/superadmin";

export async function GET(request: Request) {
  const session = await requireSuperAdminRequestSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return new NextResponse(buildPopulationImportTemplateCsv(), { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=\"population-import-template.csv\"", "Cache-Control": "no-store" } });
}

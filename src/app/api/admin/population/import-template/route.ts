import { NextResponse } from "next/server";
import { getSessionContextFromRequest, isAdminUser } from "@/lib/access-control";
import { buildPopulationImportTemplateCsv } from "@/features/population/server/import-template";

export async function GET(request: Request) {
  const session = await getSessionContextFromRequest(request);

  if (!session || !isAdminUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return new NextResponse(buildPopulationImportTemplateCsv(), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="population-import-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { searchConfiguredVillageHouses } from "@/lib/house-account-opening-service";
import { houseAccountOpeningProblemResponse } from "@/lib/house-account-opening-http";
import { allowPublicHouseSearch } from "@/lib/public-house-search-rate-limit";
import { getSystemSettings } from "@/lib/system-settings";

export async function GET(request: NextRequest) {
  const settings = await getSystemSettings();
  if (!settings.registrationEnabled) {
    return NextResponse.json({ error: "ขณะนี้ปิดรับคำขอเปิดบัญชีบ้านชั่วคราว" }, { status: 403 });
  }
  if (settings.maintenanceMode) {
    return NextResponse.json({ error: "ระบบอยู่ระหว่างการปรับปรุง" }, { status: 503 });
  }
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!query) return NextResponse.json({ results: [] });
  const clientAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? null;
  if (!allowPublicHouseSearch(clientAddress)) {
    return NextResponse.json({ error: "ค้นหาบ่อยเกินไป กรุณารอสักครู่" }, { status: 429 });
  }
  try {
    return NextResponse.json({ results: await searchConfiguredVillageHouses(query) });
  } catch (error) {
    return houseAccountOpeningProblemResponse(error);
  }
}

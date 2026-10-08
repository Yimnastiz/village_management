import { NextResponse } from "next/server";
import { clearHouseOpeningAccessCookie } from "@/lib/house-account-opening-access";

export async function POST() {
  const response = NextResponse.json({ ok: true, redirectTo: "/auth/login" });
  clearHouseOpeningAccessCookie(response);
  return response;
}

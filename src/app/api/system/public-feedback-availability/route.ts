import { NextResponse } from "next/server";
import { getSystemSettings } from "@/lib/system-settings";

export async function GET() {
  const settings = await getSystemSettings();
  return NextResponse.json({ enabled: settings.publicFeedbackEnabled });
}

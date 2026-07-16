import { NextRequest, NextResponse } from "next/server";
import { finalizeDueAccountDeletions } from "@/lib/account-deletion";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const finalized = await finalizeDueAccountDeletions();
  return NextResponse.json({ ok: true, finalized });
}

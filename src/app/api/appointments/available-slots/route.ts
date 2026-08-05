import { NextResponse } from "next/server";

// Kept only as a safe compatibility endpoint while legacy clients roll off.
// Availability is intentionally never exposed in the appointment flow.
export async function GET() {
  return NextResponse.json({ error: "Appointment availability is no longer available." }, { status: 410 });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Stable storage reference saved during upload. It deliberately resolves through
 * the attachment endpoint so authorization and download counting stay centralized.
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  const attachment = await prisma.downloadAttachment.findFirst({ where: { fileKey: key }, select: { id: true } });
  if (!attachment) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(new URL(`/api/downloads/${attachment.id}`, request.url));
}

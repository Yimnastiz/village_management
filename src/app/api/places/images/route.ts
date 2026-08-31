import { NextRequest, NextResponse } from "next/server";
import { getAdminMembership, getResidentMembership, getSessionContextFromRequest } from "@/lib/access-control";
import { MAX_IMAGE_BYTES } from "@/lib/image-constraints";
import { createPlaceUploadToken, readPlaceUpload, savePlaceUpload, validateImageBytes } from "@/lib/place-upload.server";
import { readSuperAdminSession, SUPERADMIN_ISSUE_MESSAGE_SENDER_ID } from "@/lib/superadmin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getSessionContextFromRequest(request);
  const superAdmin = readSuperAdminSession(request.headers.get("cookie")?.match(/(?:^|; )village_superadmin_session=([^;]*)/)?.[1]);
  const membership = session ? getAdminMembership(session) ?? getResidentMembership(session) : null;
  if (!session?.id && !superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const form = await request.formData();
    const requestedVillageId = String(form.get("villageId") ?? request.nextUrl.searchParams.get("villageId") ?? "").trim();
    const villageId = membership?.villageId ?? requestedVillageId;
    if (!villageId || (superAdmin && !requestedVillageId)) return NextResponse.json({ error: "ต้องระบุหมู่บ้านปลายทาง" }, { status: 400 });
    if (superAdmin && !(await prisma.village.findUnique({ where: { id: villageId }, select: { id: true } }))) return NextResponse.json({ error: "ไม่พบหมู่บ้านปลายทาง" }, { status: 404 });
    if (!superAdmin && !membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "กรุณาเลือกไฟล์รูปภาพ" }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "รูปภาพต้องมีขนาดไม่เกิน 5 MB" }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validateImageBytes(bytes, file.type)) return NextResponse.json({ error: "รองรับเฉพาะ JPG, PNG และ WebP" }, { status: 400 });
    const saved = await savePlaceUpload(bytes, file.type, villageId);
    return NextResponse.json({ ...saved, uploadToken: createPlaceUploadToken(saved.fileKey, villageId, session?.id ?? SUPERADMIN_ISSUE_MESSAGE_SENDER_ID), mimeType: file.type, size: file.size });
  } catch (error) {
    console.error("place image upload", error);
    return NextResponse.json({ error: "อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  const file = await readPlaceUpload(key);
  if (!file) return new NextResponse(null, { status: 404 });
  const body = new Blob([Uint8Array.from(file.bytes)], { type: file.mimeType });
  return new NextResponse(body, { headers: { "Content-Type": file.mimeType, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}

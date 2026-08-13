import { NextRequest, NextResponse } from "next/server";
import { getAdminMembership, getResidentMembership, getSessionContextFromRequest } from "@/lib/access-control";
import { MAX_IMAGE_BYTES } from "@/lib/image-constraints";
import { createPlaceUploadToken, readPlaceUpload, savePlaceUpload, validateImageBytes } from "@/lib/place-upload.server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getSessionContextFromRequest(request);
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = getAdminMembership(session) ?? getResidentMembership(session);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "กรุณาเลือกไฟล์รูปภาพ" }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "รูปภาพต้องมีขนาดไม่เกิน 5 MB" }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validateImageBytes(bytes, file.type)) return NextResponse.json({ error: "รองรับเฉพาะ JPG, PNG และ WebP" }, { status: 400 });
    const saved = await savePlaceUpload(bytes, file.type, membership.villageId);
    return NextResponse.json({ ...saved, uploadToken: createPlaceUploadToken(saved.fileKey, membership.villageId, session.id), mimeType: file.type, size: file.size });
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

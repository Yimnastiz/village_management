import { NextRequest, NextResponse } from "next/server";
import { getAdminMembership, getResidentMembership, getSessionContextFromRequest } from "@/lib/access-control";
import { MAX_IMAGE_BYTES } from "@/lib/image-constraints";
import { createPlaceUploadToken, readPlaceUpload, savePlaceUpload, validateImageBytes } from "@/lib/place-upload.server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getSessionContextFromRequest(request);
  const membership = session ? getAdminMembership(session) ?? getResidentMembership(session) : null;
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "กรุณาเลือกไฟล์รูปภาพ" }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "รูปภาพมีขนาดใหญ่เกินกำหนด" }, { status: 400 });
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
  const session = await getSessionContextFromRequest(request);
  const membership = session ? getAdminMembership(session) ?? getResidentMembership(session) : null;
  if (!membership) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const fileKey = request.nextUrl.searchParams.get("fileKey")?.trim();
  if (!fileKey) return NextResponse.json({ error: "Missing file key" }, { status: 400 });
  const file = await readPlaceUpload(fileKey);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(Buffer.from(file.bytes), { headers: { "Content-Type": file.mimeType, "Cache-Control": "private, max-age=300" } });
}

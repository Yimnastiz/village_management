import { NextRequest, NextResponse } from "next/server";
import { getAdminMembership, getResidentMembership, getSessionContextFromRequest } from "@/lib/access-control";
import { MAX_GALLERY_IMAGE_BYTES } from "@/lib/image-constraints";
import { createPlaceUploadToken, savePlaceUpload, validateImageBytes } from "@/lib/place-upload.server";

export const runtime = "nodejs";

/** Gallery-only policy endpoint. Its fixed server limit cannot be raised by client input. */
export async function POST(request: NextRequest) {
  const session = await getSessionContextFromRequest(request);
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = getAdminMembership(session) ?? getResidentMembership(session);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "กรุณาเลือกไฟล์รูปภาพ" }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_GALLERY_IMAGE_BYTES) return NextResponse.json({ error: "รูปภาพต้องมีขนาดไม่เกิน 10 MB" }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validateImageBytes(bytes, file.type)) return NextResponse.json({ error: "รองรับเฉพาะ JPG, PNG และ WebP" }, { status: 400 });
    const saved = await savePlaceUpload(bytes, file.type, membership.villageId);
    return NextResponse.json({ ...saved, uploadToken: createPlaceUploadToken(saved.fileKey, membership.villageId, session.id), mimeType: file.type, size: file.size });
  } catch (error) {
    console.error("gallery image upload", error);
    return NextResponse.json({ error: "อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getAdminMembership, getSessionContextFromRequest } from "@/lib/access-control";
import { MAX_DOWNLOAD_ATTACHMENT_BYTES, isAllowedDownloadFile } from "@/lib/download-upload";
import { createDownloadUploadToken, saveDownloadUpload } from "@/lib/download-upload.server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getSessionContextFromRequest(request);
  const membership = session ? getAdminMembership(session) : null;
  if (!session?.id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!membership) return NextResponse.json({ error: "ไม่มีสิทธิ์อัปโหลดเอกสาร" }, { status: 403 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "กรุณาเลือกไฟล์เอกสาร" }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_DOWNLOAD_ATTACHMENT_BYTES) return NextResponse.json({ error: "ไฟล์ต้องมีขนาดไม่เกิน 25 MB" }, { status: 400 });
    if (!isAllowedDownloadFile(file.name, file.type)) return NextResponse.json({ error: "รองรับ PDF, Office, TXT, CSV, JPG และ PNG เท่านั้น" }, { status: 400 });
    const saved = await saveDownloadUpload(new Uint8Array(await file.arrayBuffer()), file.name, file.type, membership.villageId);
    return NextResponse.json({ ...saved, fileName: file.name, mimeType: file.type, fileSize: file.size, uploadToken: createDownloadUploadToken(saved.fileKey, membership.villageId, session.id) });
  } catch (error) {
    console.error("download upload", error);
    return NextResponse.json({ error: "อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}

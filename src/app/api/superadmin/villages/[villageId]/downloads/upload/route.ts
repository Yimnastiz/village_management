import { NextRequest, NextResponse } from "next/server";
import { MAX_DOWNLOAD_ATTACHMENT_BYTES, isAllowedDownloadFile } from "@/lib/download-upload";
import { createDownloadUploadToken, saveDownloadUpload } from "@/lib/download-upload.server";
import { prisma } from "@/lib/prisma";
import { readSuperAdminSession, SUPERADMIN_ISSUE_MESSAGE_SENDER_ID } from "@/lib/superadmin-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ villageId: string }> }) {
  const { villageId } = await params;
  const session = await readSuperAdminSession(request.cookies.get("village_superadmin_session")?.value);
  if (!session) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!(await prisma.village.findUnique({ where: { id: villageId }, select: { id: true } }))) return NextResponse.json({ error: "ไม่พบหมู่บ้าน" }, { status: 404 });
  try {
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "กรุณาเลือกไฟล์เอกสาร" }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_DOWNLOAD_ATTACHMENT_BYTES) return NextResponse.json({ error: "ไฟล์ต้องมีขนาดไม่เกิน 25 MB" }, { status: 400 });
    if (!isAllowedDownloadFile(file.name, file.type)) return NextResponse.json({ error: "รองรับเฉพาะ PDF, Word, Excel, PowerPoint, TXT, CSV, JPG และ PNG" }, { status: 400 });
    const saved = await saveDownloadUpload(new Uint8Array(await file.arrayBuffer()), file.name, file.type, villageId);
    return NextResponse.json({ ...saved, fileName: file.name, fileSize: file.size, uploadToken: createDownloadUploadToken(saved.fileKey, villageId, SUPERADMIN_ISSUE_MESSAGE_SENDER_ID) });
  } catch (error) {
    console.error("superadmin download upload", error);
    return NextResponse.json({ error: "อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getAdminMembership, getResidentVillageAccess, getSessionContextFromRequest } from "@/lib/access-control";
import { readDownloadUpload } from "@/lib/download-upload.server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function legacyDataUrl(fileUrl: string) {
  const match = /^data:([^;,]+)?;base64,([A-Za-z0-9+/=]+)$/.exec(fileUrl);
  if (!match) return null;
  return { bytes: Buffer.from(match[2], "base64"), mimeType: match[1] || "application/octet-stream" };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ attachmentId: string }> }) {
  const session = await getSessionContextFromRequest(request);
  const { attachmentId } = await params;
  const attachment = await prisma.downloadAttachment.findUnique({ where: { id: attachmentId }, include: { download: { select: { id: true, villageId: true, stage: true, visibility: true } } } });
  if (!attachment) return new NextResponse(null, { status: 404 });

  const publicAllowed = attachment.download.stage === "PUBLISHED" && attachment.download.visibility === "PUBLIC";
  if (!session?.id && !publicAllowed) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (session?.id) {
    const admin = getAdminMembership(session, { villageId: attachment.download.villageId });
    if (!admin && !publicAllowed) {
      const resident = await getResidentVillageAccess(session);
      const allowed = resident?.villageId === attachment.download.villageId && attachment.download.stage === "PUBLISHED" && resident.hasResidentAccess;
      if (!allowed) return NextResponse.json({ error: "ไม่มีสิทธิ์ดาวน์โหลดไฟล์นี้" }, { status: 403 });
    }
  }

  const stored = attachment.fileKey ? await readDownloadUpload(attachment.fileKey) : null;
  const file = stored ?? legacyDataUrl(attachment.fileUrl);
  if (!file) return new NextResponse(null, { status: 404 });
  await prisma.downloadFile.update({ where: { id: attachment.download.id }, data: { downloadCount: { increment: 1 } } });
  return new NextResponse(new Blob([Uint8Array.from(file.bytes)], { type: attachment.mimeType || file.mimeType }), { headers: {
    "Content-Type": attachment.mimeType || file.mimeType,
    "Content-Length": String(file.bytes.length),
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}

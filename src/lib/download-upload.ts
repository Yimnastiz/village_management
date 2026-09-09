export const MAX_DOWNLOAD_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_DOWNLOAD_ATTACHMENTS = 5;
export const MAX_DOWNLOAD_TOTAL_BYTES = 100 * 1024 * 1024;

export const DOWNLOAD_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png";

export const DOWNLOAD_FILE_TYPES: Record<string, readonly string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword", "application/vnd.ms-word"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-word.document.12"],
  xls: ["application/vnd.ms-excel", "application/vnd.ms-excel.sheet.8"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ppt: ["application/vnd.ms-powerpoint", "application/vnd.ms-powerpoint.presentation.8"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  txt: ["text/plain"],
  csv: ["text/csv", "application/csv", "text/plain"],
  jpg: ["image/jpeg", "image/pjpeg"],
  jpeg: ["image/jpeg", "image/pjpeg"],
  png: ["image/png"],
};

export function getDownloadExtension(fileName: string) {
  return fileName.trim().split(".").pop()?.toLowerCase() ?? "";
}

function normalizedMimeType(mimeType: string) {
  return mimeType.trim().toLowerCase();
}

function isGenericBrowserMimeType(mimeType: string) {
  return mimeType === "" || mimeType === "application/octet-stream";
}

export function isAllowedDownloadFile(fileName: string, mimeType: string) {
  const allowedMimes = DOWNLOAD_FILE_TYPES[getDownloadExtension(fileName)];
  if (!allowedMimes) return false;
  const normalized = normalizedMimeType(mimeType);
  // Windows browsers frequently omit a document MIME type or use the generic
  // octet-stream value. The extension is still strictly allowlisted; an
  // explicitly contradictory MIME type remains rejected.
  return isGenericBrowserMimeType(normalized) || allowedMimes.includes(normalized);
}

export function getCanonicalDownloadMimeType(fileName: string, suppliedMimeType: string) {
  const allowedMimes = DOWNLOAD_FILE_TYPES[getDownloadExtension(fileName)];
  const normalized = normalizedMimeType(suppliedMimeType);
  if (!allowedMimes || !isAllowedDownloadFile(fileName, normalized)) return null;
  return isGenericBrowserMimeType(normalized) ? allowedMimes[0] : normalized;
}

export function downloadTypeLabel(mimeType: string | null, fileName: string) {
  const extension = getDownloadExtension(fileName).toUpperCase();
  if (extension) return extension;
  return mimeType || "FILE";
}

export const MAX_DOWNLOAD_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_DOWNLOAD_ATTACHMENTS = 5;
export const MAX_DOWNLOAD_TOTAL_BYTES = 100 * 1024 * 1024;

export const DOWNLOAD_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png";

export const DOWNLOAD_FILE_TYPES: Record<string, readonly string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  txt: ["text/plain"],
  csv: ["text/csv", "application/csv", "text/plain"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
};

export function getDownloadExtension(fileName: string) {
  return fileName.trim().split(".").pop()?.toLowerCase() ?? "";
}

export function isAllowedDownloadFile(fileName: string, mimeType: string) {
  const allowedMimes = DOWNLOAD_FILE_TYPES[getDownloadExtension(fileName)];
  return Boolean(allowedMimes?.includes(mimeType.toLowerCase()));
}

export function downloadTypeLabel(mimeType: string | null, fileName: string) {
  const extension = getDownloadExtension(fileName).toUpperCase();
  if (extension) return extension;
  return mimeType || "FILE";
}

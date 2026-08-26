import type { Prisma } from "@prisma/client";

export type NewsSubmissionPayload = {
  title: string;
  summary: string;
  content: string;
  imageUrls: string[];
  coverUrl: string | null;
  visibility: string;
  stage: string;
  isPinned: boolean;
  isDeleteRequest: boolean;
  deleteReason: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** Safely reads the persisted News submission shape without exposing arbitrary JSON to UI code. */
export function parseNewsSubmissionPayload(value: Prisma.JsonValue | unknown): NewsSubmissionPayload | null {
  const payload = asRecord(value);
  if (!payload) return null;
  const imageUrls = Array.isArray(payload.imageUrls) ? payload.imageUrls.filter((item): item is string => typeof item === "string").map((url) => url.trim()).filter(Boolean) : [];
  const coverUrl = typeof payload.coverUrl === "string" && imageUrls.includes(payload.coverUrl) ? payload.coverUrl : imageUrls[0] ?? null;
  return {
    title: typeof payload.title === "string" ? payload.title.trim() : "",
    summary: typeof payload.summary === "string" ? payload.summary.trim() : "",
    content: typeof payload.content === "string" ? payload.content.trim() : "",
    imageUrls,
    coverUrl,
    visibility: typeof payload.visibility === "string" ? payload.visibility : "",
    stage: typeof payload.stage === "string" ? payload.stage : "DRAFT",
    isPinned: payload.isPinned === true,
    isDeleteRequest: payload.isDeleteRequest === true,
    deleteReason: typeof payload.deleteReason === "string" ? payload.deleteReason.trim() : "",
  };
}

export function newsSubmissionTypeLabel(type: string, payload: NewsSubmissionPayload | null) {
  if (payload?.isDeleteRequest) return "ขอลบข่าว";
  return type === "CREATE" ? "ขอเพิ่มข่าว" : type === "UPDATE" ? "ขอแก้ไขข่าว" : "คำขอข่าว";
}

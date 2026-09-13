export type BroadcastDisplayStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";

export const broadcastStatusLabels: Record<BroadcastDisplayStatus, string> = {
  ACTIVE: "กำลังแสดง",
  EXPIRED: "หมดอายุ",
  CANCELLED: "ยกเลิกแล้ว",
};

export function broadcastStatusClassName(status: BroadcastDisplayStatus) {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700";
  if (status === "CANCELLED") return "bg-rose-50 text-rose-700";
  return "bg-gray-100 text-gray-600";
}

export function broadcastExpiryLabel(expiresAt: Date | null) {
  return expiresAt?.toLocaleString("th-TH") ?? "ไม่กำหนดวันหมดอายุ";
}

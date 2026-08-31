import type { MemberQueryRow, MemberRow } from "./types";

export function maskPhone(phone: string | null | undefined) {
  if (!phone) return "-";
  if (phone.length < 7) return `${phone.slice(0, 2)}•••`;
  return `${phone.slice(0, 2)}••••${phone.slice(-4)}`;
}

export function serializeMemberRows(rows: MemberQueryRow[]): MemberRow[] {
  return rows.map((row) => ({ ...row, joinedAt: row.joinedAt?.toISOString() ?? null }));
}

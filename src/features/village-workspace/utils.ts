import type { MemberQueryRow, MemberRow } from "./types";

export function serializeMemberRows(rows: MemberQueryRow[]): MemberRow[] {
  return rows.map((row) => ({ ...row, joinedAt: row.joinedAt?.toISOString() ?? null, updatedAt: row.updatedAt.toISOString() }));
}

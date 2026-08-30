import { PersonStatus } from "@prisma/client";

export function personStatusBadgeVariant(status: PersonStatus): "success" | "warning" | "default" {
  if (status === PersonStatus.ACTIVE) return "success";
  if (status === PersonStatus.MOVED_OUT) return "warning";
  return "default";
}

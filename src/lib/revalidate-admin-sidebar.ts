import "server-only";

import { revalidatePath } from "next/cache";

/** Revalidates the shared admin layout after an actionable workflow changes. */
export function revalidateAdminSidebar() {
  revalidatePath("/admin", "layout");
}

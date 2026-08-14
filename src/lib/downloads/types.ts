import type { z } from "zod";
import type { downloadFormSchema } from "./schema";

export type DownloadFormInput = z.infer<typeof downloadFormSchema>;
export type DownloadActionResult =
  | { success: true; id?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

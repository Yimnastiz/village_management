import { requireVillagePagePermission } from "@/lib/admin-permission.server";

export default async function FeedbackLayout({ children }: { children: React.ReactNode }) {
  await requireVillagePagePermission("feedback.manage", { callbackUrl: "/admin/feedback" });
  return children;
}

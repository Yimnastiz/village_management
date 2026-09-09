import { requireVillagePagePermission } from "@/lib/admin-permission.server";
export default async function DataQualityLayout({ children }: { children: React.ReactNode }) { await requireVillagePagePermission("data-quality.view", { callbackUrl: "/admin/data-quality" }); return children; }

import { requireVillagePagePermission } from "@/lib/admin-permission.server";
export default async function BroadcastsLayout({ children }: { children: React.ReactNode }) { await requireVillagePagePermission("broadcasts.manage", { callbackUrl: "/admin/broadcasts" }); return children; }

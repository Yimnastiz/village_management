import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { getWorkspaceVillage } from "@/features/village-workspace/server/queries";
import { WorkspaceNav } from "./workspace-nav";
import { WorkspaceToast } from "./workspace-toast";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";

export default async function VillageWorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ villageId: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId } = await params;
  const village = await getWorkspaceVillage(villageId);
  const displayName = `${village.moo ? `หมู่ ${village.moo} ` : ""}${village.name}`;
  return <div className="space-y-5">
    <SuperAdminPageHeaderRegistration context={{ title: displayName, description: "พื้นที่ทำงานหมู่บ้าน" }} />
    <WorkspaceToast />
    <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">โหมดช่วยเหลือ</Badge>
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${village.isActive ? "text-emerald-700" : "text-slate-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${village.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />{village.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}</span>
          </div>
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{displayName}</h1>
          <p className="mt-1 text-sm text-slate-500">ต.{village.subdistrict ?? "-"} อ.{village.district ?? "-"} จ.{village.province ?? "-"}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400"><ShieldCheck className="h-3.5 w-3.5" />การแก้ไขสำคัญจะถูกบันทึกใน Audit Log ของหมู่บ้านนี้</p>
        </div>
        <Link href="/superadmin/villages" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" />กลับรายการหมู่บ้าน</Link>
      </div>
    </header>
    <WorkspaceNav villageId={villageId} />
    <main>{children}</main>
  </div>;
}

import Link from "next/link";
import { AlertCircle, CalendarClock, Database, Home, Link2, ShieldCheck, UserRoundCog, UserRoundPlus, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { getVillageDashboard, getWorkspaceVillage } from "@/features/village-workspace/server/queries";
import { VillageDangerZone } from "./village-danger-zone";

export default async function VillageOverviewPage({ params }: { params: Promise<{ villageId: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId } = await params;
  const [data, village] = await Promise.all([getVillageDashboard(villageId), getWorkspaceVillage(villageId)]);
  const base = `/superadmin/villages/${villageId}`;
  const tasks = [
    { label: "คำขอผูกบ้านรอตรวจ", count: data.pendingBindings, href: `${base}/binding-requests?status=PENDING` },
    { label: "ปัญหาที่ยังไม่ปิด", count: data.openIssues, href: `${base}/issues?status=OPEN` },
    { label: "นัดหมายรอดำเนินการ", count: data.pendingAppointments, href: `${base}/appointments?status=PENDING_APPROVAL` },
  ];

  return <div className="space-y-5">
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        {village.catalogVillageId ? <Database className="h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" /> : <UserRoundPlus className="h-4 w-4 shrink-0 text-violet-700" aria-hidden="true" />}
        <div className="min-w-0"><p className="text-xs font-medium text-slate-500">แหล่งข้อมูล</p><p className="truncate text-sm font-medium text-slate-800">{village.catalogVillageId ? "ฐานข้อมูลอ้างอิง" : "เพิ่มโดยผู้ดูแลระบบ"}</p>{!village.catalogVillageId && village.sourceNote ? <p className="mt-0.5 truncate text-xs text-slate-500" title={village.sourceNote}>ที่มาเพิ่มเติม: {village.sourceNote}</p> : null}</div>
      </div>
      <Badge variant={village.isActive ? "success" : "outline"}>{village.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}</Badge>
    </section>
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard title="สมาชิกที่ใช้งานอยู่" value={data.activeMembers} icon={UsersRound} color="blue" />
      <StatCard title="บ้านทั้งหมด" value={data.houses} icon={Home} color="green" />
      <StatCard title="ประชากร" value={data.people} icon={UsersRound} color="purple" />
      <StatCard title="ผู้ดูแลหมู่บ้าน" value={data.admins} icon={UserRoundCog} color="yellow" />
      <StatCard title="คำขอผูกบ้าน" value={data.pendingBindings} icon={Link2} color="blue" />
      <StatCard title="ปัญหาที่ยังไม่ปิด" value={data.openIssues} icon={AlertCircle} color="yellow" />
      <StatCard title="นัดหมายรอดำเนินการ" value={data.pendingAppointments} icon={CalendarClock} color="purple" />
    </section>

    <div className="grid gap-5 xl:grid-cols-3">
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="font-semibold text-slate-900">สิ่งที่ต้องดำเนินการ</h2>
        <div className="mt-3 divide-y divide-slate-100">{tasks.map((task) => <Link key={task.label} href={task.href} className="flex items-center justify-between gap-3 py-3 text-sm hover:text-slate-950"><span className="text-slate-600">{task.label}</span><Badge variant={task.count ? "warning" : "outline"}>{task.count}</Badge></Link>)}</div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">รายการล่าสุด</h2><Link href={`${base}/issues`} className="text-xs text-slate-500 hover:text-slate-900">ดูทั้งหมด</Link></div>
        <div className="mt-3 divide-y divide-slate-100">{data.recentIssues.length ? data.recentIssues.map((item) => <Link key={item.id} href={`${base}/issues/${item.id}`} className="flex items-start justify-between gap-3 py-3 text-sm"><div className="min-w-0"><p className="truncate font-medium text-slate-700">{item.title}</p><p className="mt-0.5 text-xs text-slate-400">{item.createdAt.toLocaleDateString("th-TH")}</p></div><Badge variant="outline">{item.stage}</Badge></Link>) : <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีรายการปัญหา</p>}</div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">กิจกรรมล่าสุด</h2><Link href={`${base}/audit`} className="text-xs text-slate-500 hover:text-slate-900">ดูบันทึกการใช้งาน</Link></div>
        <div className="mt-3 divide-y divide-slate-100">{data.recentAudit.length ? data.recentAudit.map((log) => <div key={log.id} className="py-3 text-sm"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-slate-400" /><p className="truncate font-medium text-slate-700">{log.action} · {log.resource}</p></div><p className="mt-1 pl-6 text-xs text-slate-400">{log.user?.name ?? "ระบบ"} · {log.createdAt.toLocaleString("th-TH")}</p></div>) : <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีกิจกรรม</p>}</div>
      </section>
    </div>
    <VillageDangerZone villageId={villageId} villageName={village.name} />
  </div>;
}

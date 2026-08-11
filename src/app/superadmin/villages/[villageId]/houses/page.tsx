import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { QueryPagination } from "@/components/ui/query-pagination";
import { HouseForm } from "@/features/population/components/house-form";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { getWorkspaceVillage } from "@/features/village-workspace/server/queries";
import { createSuperAdminHouseAction } from "../population-actions";

export default async function Page({params,searchParams}:{params:Promise<{villageId:string}>;searchParams:Promise<{q?:string;status?:string;page?:string}>}){
 await requireSuperAdminPageSession(); const {villageId}=await params; const search=await searchParams; const village=await getWorkspaceVillage(villageId);
 const q=(search.q??"").trim(); const page=Math.max(1,Number(search.page)||1); const size=25;
 const where:Prisma.HouseWhereInput={villageId,...(q?{OR:[{houseNumber:{contains:q,mode:"insensitive"}},{address:{contains:q,mode:"insensitive"}}]}:{})};
 const [rows,total]=await Promise.all([prisma.house.findMany({where,skip:(page-1)*size,take:size,orderBy:{houseNumber:"asc"},include:{_count:{select:{persons:true,memberships:true}}}}),prisma.house.count({where})]); const base=`/superadmin/villages/${villageId}/houses`;
 const action=createSuperAdminHouseAction.bind(null,villageId);
 return <div className="space-y-6"><header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-2xl font-semibold text-slate-950">ทะเบียนบ้าน</h2><p className="mt-1 text-sm text-slate-500">จัดการบ้านเฉพาะ {village.name} · {total.toLocaleString("th-TH")} หลัง</p></div></header>
 <HouseForm action={action}/>
 <form method="get" className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-[1fr_auto]"><input name="q" defaultValue={q} placeholder="ค้นหาเลขที่บ้านหรือที่อยู่" className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm"/><button className="min-h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white">ค้นหา</button></form>
 <section className="overflow-hidden rounded-xl border bg-white"><div className="overflow-x-auto"><table className="min-w-[640px] w-full text-sm"><thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-4 py-3">บ้านเลขที่</th><th className="px-4 py-3">ประชากร</th><th className="px-4 py-3">สมาชิกระบบ</th><th className="px-4 py-3 text-right">จัดการ</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-t"><td className="px-4 py-3 font-medium">{row.houseNumber}<p className="mt-0.5 text-xs font-normal text-slate-400">{row.address||"ไม่ระบุที่อยู่เพิ่มเติม"}</p></td><td className="px-4 py-3">{row._count.persons} คน</td><td className="px-4 py-3">{row._count.memberships} บัญชี</td><td className="px-4 py-3 text-right"><Link href={`${base}/${row.id}`} className="inline-flex min-h-9 items-center rounded-lg border px-3 font-medium hover:bg-slate-50">ดูรายละเอียด</Link></td></tr>)}</tbody></table></div>{!rows.length?<div className="border-t p-10 text-center text-sm text-slate-500">ไม่พบข้อมูลบ้านตามเงื่อนไข</div>:null}</section>
 <QueryPagination pathname={base} page={page} totalPages={Math.max(1,Math.ceil(total/size))} params={{q:q||undefined}}/></div>;
}

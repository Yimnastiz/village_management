import Link from "next/link";
import { NewsVisibility, TransparencyStage } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { prisma } from "@/lib/prisma";
import { EmptyState, formatDate, PageHeader, Pager, SearchBar, SupportNotice } from "../public-content-ui";
import { SuperAdminDeleteTransparencyButton, SuperAdminTransparencyForm } from "./superadmin-transparency-form";

const TAKE = 10;

export default async function SuperAdminVillageTransparencyPage({ params, searchParams }: { params: Promise<{ villageId: string }>; searchParams: Promise<{ q?: string; status?: string; visibility?: string; sort?: string; year?: string; page?: string; edit?: string }> }) {
  const { villageId } = await params;
  const query = await searchParams;
  const page = Math.max(Number(query.page ?? "1") || 1, 1);
  const search = query.q?.trim() ?? "";
  const status = ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(query.status?.trim() ?? "") ? query.status!.trim() : "";
  const visibility = ["PUBLIC", "RESIDENT_ONLY"].includes(query.visibility?.trim() ?? "") ? query.visibility!.trim() : "";
  const sort = ["newest", "oldest", "amount"].includes(query.sort?.trim() ?? "") ? query.sort!.trim() : "newest";
  const year = query.year?.trim() ?? "";
  const where = { villageId, ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" as const } }, { category: { contains: search, mode: "insensitive" as const } }] } : {}), ...(status ? { stage: status as TransparencyStage } : {}), ...(visibility ? { visibility: visibility as NewsVisibility } : {}), ...(year ? { fiscalYear: year } : {}) };
  const orderBy = sort === "oldest" ? { createdAt: "asc" as const } : sort === "amount" ? { amount: "desc" as const } : { updatedAt: "desc" as const };
  const [village, rows, total, editing] = await Promise.all([prisma.village.findUnique({ where: { id: villageId }, select: { name: true } }), prisma.transparencyRecord.findMany({ where, orderBy, skip: (page - 1) * TAKE, take: TAKE }), prisma.transparencyRecord.count({ where }), query.edit ? prisma.transparencyRecord.findFirst({ where: { id: query.edit, villageId } }) : null]);
  const base = `/superadmin/villages/${villageId}/transparency`;
  return <div className="space-y-4"><PageHeader title="ความโปร่งใส" description={`จัดการข้อมูลความโปร่งใสของ ${village?.name ?? "หมู่บ้าน"} เพื่อการสนับสนุนงานหมู่บ้าน`} villageId={villageId} module="transparency" /><SupportNotice villageName={village?.name ?? "-"} /><SearchBar action={base} search={search}><Select name="status" label="สถานะ" defaultValue={status || "ALL"} options={[{ value: "ALL", label: "ทั้งหมด" }, { value: "DRAFT", label: "ฉบับร่าง" }, { value: "PUBLISHED", label: "เผยแพร่" }, { value: "ARCHIVED", label: "เก็บถาวร" }]} /><Select name="visibility" label="การมองเห็น" defaultValue={visibility || "ALL"} options={[{ value: "ALL", label: "ทั้งหมด" }, { value: "PUBLIC", label: "สาธารณะ" }, { value: "RESIDENT_ONLY", label: "เฉพาะลูกบ้าน" }]} /><Select name="sort" label="เรียง" defaultValue={sort} options={[{ value: "newest", label: "แก้ไขล่าสุด" }, { value: "oldest", label: "เก่าก่อน" }, { value: "amount", label: "งบสูงก่อน" }]} /><Input name="year" label="ปี" defaultValue={year} className="w-32" /></SearchBar><SuperAdminTransparencyForm villageId={villageId} initial={editing} /><div className="rounded-xl border bg-white"><div className="border-b px-4 py-3 text-sm text-slate-600">ทั้งหมด {total} รายการ</div>{rows.length === 0 ? <EmptyState text="ยังไม่มีข้อมูลความโปร่งใสตามเงื่อนไขนี้" /> : rows.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-b-0"><div className="min-w-0"><h3 className="break-words font-semibold">{item.title}</h3><p className="text-sm text-slate-600">{item.category ?? "-"} · {item.fiscalYear ?? "-"} · {item.amount ?? "-"}</p><p className="text-xs text-slate-500">สถานะ {item.stage} · {item.visibility} · เผยแพร่ {formatDate(item.publishedAt)} · แก้ไข {formatDate(item.updatedAt)}</p></div><div className="flex shrink-0 flex-wrap gap-2"><Link className="rounded-md border px-3 py-2 text-sm" href={`${base}?edit=${item.id}`}>แก้ไข</Link><SuperAdminDeleteTransparencyButton villageId={villageId} recordId={item.id} title={item.title} /></div></div>)}</div><Pager basePath={`${base}?q=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&visibility=${encodeURIComponent(visibility)}&sort=${encodeURIComponent(sort)}&year=${encodeURIComponent(year)}`} page={page} hasNext={page * TAKE < total} /></div>;
}

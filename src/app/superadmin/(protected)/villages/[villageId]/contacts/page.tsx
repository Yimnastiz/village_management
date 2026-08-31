import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { PageHeader, Pager, EmptyState, formatDate } from "../public-content-ui";
import { SuperAdminContactForm } from "./superadmin-contact-form";

const TAKE = 10;
export default async function Contacts({ params, searchParams }: { params: Promise<{ villageId: string }>; searchParams: Promise<{ q?: string; page?: string; edit?: string }> }) {
  const { villageId } = await params; const query = await searchParams; const q = query.q?.trim() ?? ""; const page = Math.max(Number(query.page ?? 1) || 1, 1);
  const where: Prisma.ContactDirectoryWhereInput = { villageId, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { role: { contains: q, mode: "insensitive" } }, { phone: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { category: { contains: q, mode: "insensitive" } }] } : {}) };
  const [village, rows, total, editing] = await Promise.all([prisma.village.findUnique({ where: { id: villageId }, select: { name: true } }), prisma.contactDirectory.findMany({ where, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], skip: (page - 1) * TAKE, take: TAKE }), prisma.contactDirectory.count({ where }), query.edit ? prisma.contactDirectory.findFirst({ where: { id: query.edit, villageId } }) : null]);
  if (!village) notFound();
  return <div className="space-y-4"><PageHeader title="ช่องทางติดต่อ" description={`จัดการข้อมูลการติดต่อของ ${village.name} เพื่อการสนับสนุนงานหมู่บ้าน`} villageId={villageId} module="contacts" /><form className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4"><Input name="q" label="ค้นหา" defaultValue={q} placeholder="ชื่อ ตำแหน่ง โทรศัพท์ หรืออีเมล" /><Button type="submit">ค้นหา</Button><Link href={`/superadmin/villages/${villageId}/contacts`}><Button type="button" variant="outline">ล้าง</Button></Link></form><SuperAdminContactForm villageId={villageId} initial={editing ?? undefined} /><div className="rounded-xl border bg-white"><div className="border-b px-4 py-3 text-sm text-gray-600">ทั้งหมด {total} รายการ</div>{rows.length ? rows.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-0"><div className="min-w-0"><h3 className="break-words font-semibold">{item.name}</h3><p className="break-words text-sm text-gray-600">{item.role ?? "-"} · {item.category ?? "-"} · {item.phone ?? "-"} · {item.email ?? "-"}</p><p className="text-xs text-gray-500">{item.isPublic ? "สาธารณะ" : "ลูกบ้าน"} · ลำดับ {item.sortOrder} · แก้ไข {formatDate(item.updatedAt)}</p></div><Link href={`/superadmin/villages/${villageId}/contacts?edit=${item.id}`}><Button type="button" size="sm" variant="outline">แก้ไข</Button></Link></div>) : <EmptyState text="ไม่พบข้อมูลผู้ติดต่อ" />}</div><Pager basePath={`/superadmin/villages/${villageId}/contacts`} page={page} hasNext={page * TAKE < total} /></div>;
}

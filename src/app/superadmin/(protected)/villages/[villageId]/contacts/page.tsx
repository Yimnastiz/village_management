import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/prisma";
import { EmptyState, formatDate, HiddenId, PageHeader, Pager, ReasonField, SearchBar, SupportNotice } from "../public-content-ui";
import { superAdminDeleteContactAction, superAdminSaveContactAction } from "../public-content-actions";

const TAKE = 10;

export default async function SuperAdminVillageContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ villageId: string }>;
  searchParams: Promise<{ q?: string; page?: string; edit?: string }>;
}) {
  const { villageId } = await params;
  const query = await searchParams;
  const page = Math.max(Number(query.page ?? "1") || 1, 1);
  const search = query.q?.trim() ?? "";
  const where = {
    villageId,
    ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { role: { contains: search, mode: "insensitive" as const } }, { category: { contains: search, mode: "insensitive" as const } }] } : {}),
  };
  const [village, rows, total, editing] = await Promise.all([
    prisma.village.findUnique({ where: { id: villageId }, select: { name: true } }),
    prisma.contactDirectory.findMany({ where, orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }], skip: (page - 1) * TAKE, take: TAKE }),
    prisma.contactDirectory.count({ where }),
    query.edit ? prisma.contactDirectory.findFirst({ where: { id: query.edit, villageId } }) : null,
  ]);
  const saveAction = superAdminSaveContactAction.bind(null, villageId);
  const deleteAction = superAdminDeleteContactAction.bind(null, villageId);

  return (
    <div className="space-y-4">
      <PageHeader title="รายชื่อผู้ติดต่อ" description="จัดการข้อมูลติดต่อสาธารณะและลำดับการแสดงผล" villageId={villageId} module="contacts" />
      <SupportNotice villageName={village?.name ?? "-"} />
      <SearchBar action={`/superadmin/villages/${villageId}/contacts`} search={search} />

      <form action={saveAction} className="space-y-3 rounded-lg border bg-white p-4">
        <HiddenId id={editing?.id} />
        <h3 className="font-semibold text-slate-900">{editing ? "แก้ไขผู้ติดต่อ" : "สร้างผู้ติดต่อ"}</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <Input name="name" label="ชื่อ" defaultValue={editing?.name ?? ""} required />
          <Input name="role" label="ตำแหน่ง" defaultValue={editing?.role ?? ""} />
          <Input name="category" label="หน่วยงาน/หมวดหมู่" defaultValue={editing?.category ?? ""} />
          <Input name="phone" label="เบอร์โทร" defaultValue={editing?.phone ?? ""} />
          <Input name="email" label="ช่องทางติดต่อ/อีเมล" type="email" defaultValue={editing?.email ?? ""} />
          <Input name="sortOrder" label="ลำดับ" defaultValue={String(editing?.sortOrder ?? 0)} inputMode="numeric" />
        </div>
        <Textarea name="address" label="ที่อยู่/หมายเหตุ" rows={2} defaultValue={editing?.address ?? ""} />
        <label className="flex items-center gap-2 text-sm text-slate-700"><input name="isPublic" type="checkbox" defaultChecked={editing?.isPublic ?? true} /> แสดงผลสาธารณะ</label>
        <ReasonField />
        <Button type="submit">{editing ? "บันทึกการแก้ไข" : "สร้างผู้ติดต่อ"}</Button>
      </form>

      <div className="rounded-lg border bg-white">
        <div className="border-b px-4 py-3 text-sm text-slate-600">ทั้งหมด {total} รายการ</div>
        {rows.length === 0 ? <EmptyState text="ยังไม่มีรายชื่อผู้ติดต่อ" /> : rows.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-b-0">
            <div>
              <h3 className="font-semibold">{item.name}</h3>
              <p className="text-sm text-slate-600">{item.role ?? "-"} · {item.category ?? "-"} · {item.phone ?? "-"} · {item.email ?? "-"}</p>
              <p className="text-xs text-slate-500">visibility {item.isPublic ? "PUBLIC" : "RESIDENT"} · ลำดับ {item.sortOrder} · แก้ไข {formatDate(item.updatedAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link className="rounded-md border px-3 py-2 text-sm" href={`/superadmin/villages/${villageId}/contacts?edit=${item.id}`}>แก้ไข</Link>
              <form action={deleteAction} className="flex gap-2">
                <input type="hidden" name="resourceId" value={item.id} />
                <Input name="supportReason" aria-label="เหตุผล" placeholder="เหตุผล" required minLength={5} maxLength={500} />
                <Button type="submit" variant="danger">Delete</Button>
              </form>
            </div>
          </div>
        ))}
      </div>
      <Pager basePath={`/superadmin/villages/${villageId}/contacts`} page={page} hasNext={page * TAKE < total} />
    </div>
  );
}

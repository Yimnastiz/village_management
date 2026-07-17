import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/prisma";
import { EmptyState, formatDate, HiddenId, PageHeader, Pager, ReasonField, SearchBar, SupportNotice } from "../public-content-ui";
import { superAdminDeleteEventAction, superAdminSaveEventAction } from "../public-content-actions";

const TAKE = 10;

function toDateTimeLocal(value: Date | null | undefined) {
  if (!value) return "";
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default async function SuperAdminVillageCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ villageId: string }>;
  searchParams: Promise<{ q?: string; filter?: string; page?: string; edit?: string }>;
}) {
  const { villageId } = await params;
  const query = await searchParams;
  const page = Math.max(Number(query.page ?? "1") || 1, 1);
  const search = query.q?.trim() ?? "";
  const filter = query.filter?.trim() ?? "ALL";
  const now = new Date();
  const where = {
    villageId,
    ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" as const } }, { location: { contains: search, mode: "insensitive" as const } }] } : {}),
    ...(filter === "UPCOMING" ? { startsAt: { gte: now } } : {}),
    ...(filter === "PAST" ? { startsAt: { lt: now } } : {}),
    ...(filter === "PUBLIC" ? { isPublic: true } : {}),
    ...(filter === "PRIVATE" ? { isPublic: false } : {}),
  };
  const [village, rows, total, editing] = await Promise.all([
    prisma.village.findUnique({ where: { id: villageId }, select: { name: true } }),
    prisma.villageEvent.findMany({ where, orderBy: { startsAt: "desc" }, skip: (page - 1) * TAKE, take: TAKE }),
    prisma.villageEvent.count({ where }),
    query.edit ? prisma.villageEvent.findFirst({ where: { id: query.edit, villageId } }) : null,
  ]);
  const saveAction = superAdminSaveEventAction.bind(null, villageId);
  const deleteAction = superAdminDeleteEventAction.bind(null, villageId);

  return (
    <div className="space-y-4">
      <PageHeader title="ปฏิทินกิจกรรม" description="จัดการกิจกรรมแบบ list view พร้อม validation เวลาเริ่มและสิ้นสุด" villageId={villageId} module="calendar" />
      <SupportNotice villageName={village?.name ?? "-"} />
      <SearchBar action={`/superadmin/villages/${villageId}/calendar`} search={search}>
        <Select name="filter" label="Filter" defaultValue={filter} options={[
          { value: "ALL", label: "ทั้งหมด" },
          { value: "UPCOMING", label: "Upcoming" },
          { value: "PAST", label: "Past" },
          { value: "PUBLIC", label: "Public" },
          { value: "PRIVATE", label: "Private" },
        ]} />
      </SearchBar>

      <form action={saveAction} className="space-y-3 rounded-lg border bg-white p-4">
        <HiddenId id={editing?.id} />
        <h3 className="font-semibold text-slate-900">{editing ? "แก้ไขกิจกรรม" : "สร้างกิจกรรม"}</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Input name="title" label="ชื่อกิจกรรม" defaultValue={editing?.title ?? ""} required />
          <Input name="location" label="สถานที่" defaultValue={editing?.location ?? ""} />
          <Input name="startsAt" label="วันเวลาเริ่ม" type="datetime-local" defaultValue={toDateTimeLocal(editing?.startsAt)} required />
          <Input name="endsAt" label="วันเวลาสิ้นสุด" type="datetime-local" defaultValue={toDateTimeLocal(editing?.endsAt)} />
        </div>
        <Textarea name="description" label="รายละเอียด" rows={3} defaultValue={editing?.description ?? ""} />
        <label className="flex items-center gap-2 text-sm text-slate-700"><input name="isPublic" type="checkbox" defaultChecked={editing?.isPublic ?? true} /> แสดงผลสาธารณะ</label>
        <ReasonField />
        <Button type="submit">{editing ? "บันทึกการแก้ไข" : "สร้างกิจกรรม"}</Button>
      </form>

      <div className="rounded-lg border bg-white">
        <div className="border-b px-4 py-3 text-sm text-slate-600">ทั้งหมด {total} รายการ</div>
        {rows.length === 0 ? <EmptyState text="ยังไม่มีกิจกรรมตามเงื่อนไขนี้" /> : rows.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-b-0">
            <div>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="text-sm text-slate-600">{item.location ?? "-"} · {formatDate(item.startsAt)} ถึง {formatDate(item.endsAt)}</p>
              <p className="text-xs text-slate-500">status {item.isPublic ? "PUBLIC" : "PRIVATE"} · แก้ไข {formatDate(item.updatedAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link className="rounded-md border px-3 py-2 text-sm" href={`/superadmin/villages/${villageId}/calendar?edit=${item.id}`}>แก้ไข</Link>
              <form action={deleteAction} className="flex gap-2">
                <input type="hidden" name="resourceId" value={item.id} />
                <Input name="supportReason" aria-label="เหตุผล" placeholder="เหตุผล" required minLength={10} maxLength={500} />
                <Button type="submit" variant="danger">Cancel/Delete</Button>
              </form>
            </div>
          </div>
        ))}
      </div>
      <Pager basePath={`/superadmin/villages/${villageId}/calendar`} page={page} hasNext={page * TAKE < total} />
    </div>
  );
}


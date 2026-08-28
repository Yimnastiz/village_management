import Link from "next/link";
import { TransparencyStage } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/prisma";
import { EmptyState, formatDate, HiddenId, PageHeader, Pager, ReasonField, SearchBar, SupportNotice, VisibilitySelect } from "../public-content-ui";
import { superAdminDeleteTransparencyAction, superAdminSaveTransparencyAction } from "../public-content-actions";

const TAKE = 10;

export default async function SuperAdminVillageTransparencyPage({
  params,
  searchParams,
}: {
  params: Promise<{ villageId: string }>;
  searchParams: Promise<{ q?: string; status?: string; year?: string; page?: string; edit?: string }>;
}) {
  const { villageId } = await params;
  const query = await searchParams;
  const page = Math.max(Number(query.page ?? "1") || 1, 1);
  const search = query.q?.trim() ?? "";
  const status = query.status?.trim() ?? "";
  const year = query.year?.trim() ?? "";
  const where = {
    villageId,
    ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" as const } }, { category: { contains: search, mode: "insensitive" as const } }] } : {}),
    ...(status && status !== "ALL" ? { stage: status as TransparencyStage } : {}),
    ...(year ? { fiscalYear: year } : {}),
  };
  const [village, rows, total, editing] = await Promise.all([
    prisma.village.findUnique({ where: { id: villageId }, select: { name: true } }),
    prisma.transparencyRecord.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * TAKE, take: TAKE }),
    prisma.transparencyRecord.count({ where }),
    query.edit ? prisma.transparencyRecord.findFirst({ where: { id: query.edit, villageId } }) : null,
  ]);
  const saveAction = superAdminSaveTransparencyAction.bind(null, villageId);
  const deleteAction = superAdminDeleteTransparencyAction.bind(null, villageId);

  return (
    <div className="space-y-4">
      <PageHeader title="ความโปร่งใส" description="จัดการข้อมูลความโปร่งใสตามหมวดหมู่ ปีงบประมาณ สถานะ และ visibility" villageId={villageId} module="transparency" />
      <SupportNotice villageName={village?.name ?? "-"} />
      <SearchBar action={`/superadmin/villages/${villageId}/transparency`} search={search}>
        <Select name="status" label="สถานะ" defaultValue={status || "ALL"} options={[{ value: "ALL", label: "ทั้งหมด" }, { value: "DRAFT", label: "ฉบับร่าง" }, { value: "PUBLISHED", label: "เผยแพร่" }, { value: "ARCHIVED", label: "เก็บถาวร" }]} />
        <Input name="year" label="ปี" defaultValue={year} className="w-32" />
      </SearchBar>

      <form action={saveAction} className="space-y-3 rounded-lg border bg-white p-4">
        <HiddenId id={editing?.id} />
        <h3 className="font-semibold text-slate-900">{editing ? "แก้ไขรายการ" : "สร้างรายการ"}</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <Input name="title" label="ชื่อรายการ" defaultValue={editing?.title ?? ""} required />
          <Input name="category" label="ประเภท" defaultValue={editing?.category ?? ""} />
          <Input name="fiscalYear" label="ปี/ช่วงเวลา" defaultValue={editing?.fiscalYear ?? ""} />
          <Input name="amount" label="จำนวนเงิน" defaultValue={editing?.amount?.toString() ?? ""} inputMode="decimal" />
          <Select name="stage" label="สถานะ" defaultValue={editing?.stage ?? "DRAFT"} options={[{ value: "DRAFT", label: "ฉบับร่าง" }, { value: "PUBLISHED", label: "เผยแพร่" }, { value: "ARCHIVED", label: "เก็บถาวร" }]} />
          <VisibilitySelect defaultValue={editing?.visibility ?? "PUBLIC"} />
        </div>
        <Textarea name="description" label="รายละเอียด" rows={4} defaultValue={editing?.description ?? ""} />
        <ReasonField />
        <Button type="submit">{editing ? "บันทึกการแก้ไข" : "สร้างรายการ"}</Button>
      </form>

      <div className="rounded-lg border bg-white">
        <div className="border-b px-4 py-3 text-sm text-slate-600">ทั้งหมด {total} รายการ</div>
        {rows.length === 0 ? <EmptyState text="ยังไม่มีข้อมูลความโปร่งใสตามเงื่อนไขนี้" /> : rows.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-b-0">
            <div>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="text-sm text-slate-600">{item.category ?? "-"} · {item.fiscalYear ?? "-"} · {item.amount ?? "-"}</p>
              <p className="text-xs text-slate-500">สถานะ {item.stage} · {item.visibility} · เผยแพร่ {formatDate(item.publishedAt)} · แก้ไข {formatDate(item.updatedAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link className="rounded-md border px-3 py-2 text-sm" href={`/superadmin/villages/${villageId}/transparency?edit=${item.id}`}>แก้ไข</Link>
              <form action={deleteAction} className="flex gap-2">
                <input type="hidden" name="resourceId" value={item.id} />
                <Input name="supportReason" aria-label="เหตุผล" placeholder="เหตุผล" required minLength={5} maxLength={500} />
                <Button type="submit" variant="danger">Delete</Button>
              </form>
            </div>
          </div>
        ))}
      </div>
      <Pager basePath={`/superadmin/villages/${villageId}/transparency`} page={page} hasNext={page * TAKE < total} />
    </div>
  );
}

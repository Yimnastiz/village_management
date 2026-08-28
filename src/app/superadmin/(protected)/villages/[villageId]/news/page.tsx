import Link from "next/link";
import { NewsStage } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SuperAdminNewsImageField } from "@/components/news/superadmin-news-image-field";
import { prisma } from "@/lib/prisma";
import {
  EmptyState,
  formatDate,
  HiddenId,
  PageHeader,
  Pager,
  ReasonField,
  SearchBar,
  SupportNotice,
  VisibilitySelect,
} from "../public-content-ui";
import {
  superAdminDeleteNewsAction,
  superAdminSaveNewsAction,
  superAdminSetNewsStageAction,
} from "../public-content-actions";

const TAKE = 10;

export default async function SuperAdminVillageNewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ villageId: string }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string; edit?: string }>;
}) {
  const { villageId } = await params;
  const query = await searchParams;
  const page = Math.max(Number(query.page ?? "1") || 1, 1);
  const search = query.q?.trim() ?? "";
  const status = query.status?.trim() ?? "";
  const where = {
    villageId,
    ...(search
      ? { OR: [{ title: { contains: search, mode: "insensitive" as const } }, { summary: { contains: search, mode: "insensitive" as const } }] }
      : {}),
    ...(status && status !== "ALL" ? { stage: status as NewsStage } : {}),
  };
  const [village, rows, total, editing] = await Promise.all([
    prisma.village.findUnique({ where: { id: villageId }, select: { name: true } }),
    prisma.news.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * TAKE,
      take: TAKE,
      select: { id: true, title: true, summary: true, stage: true, visibility: true, isPinned: true, publishedAt: true, updatedAt: true, author: { select: { name: true } }, imageUrls: true, coverUrl: true, content: true },
    }),
    prisma.news.count({ where }),
    query.edit ? prisma.news.findFirst({ where: { id: query.edit, villageId } }) : null,
  ]);

  const saveAction = superAdminSaveNewsAction.bind(null, villageId);
  const stageAction = superAdminSetNewsStageAction.bind(null, villageId);
  const deleteAction = superAdminDeleteNewsAction.bind(null, villageId);

  return (
    <div className="space-y-4">
      <PageHeader title="ข่าวสาร" description="จัดการข่าวที่แสดงในพื้นที่สาธารณะของหมู่บ้านเป้าหมาย" villageId={villageId} module="news" />
      <SupportNotice villageName={village?.name ?? "-"} />

      <SearchBar action={`/superadmin/villages/${villageId}/news`} search={search}>
        <Select
          name="status"
          label="สถานะ"
          defaultValue={status || "ALL"}
          options={[
            { value: "ALL", label: "ทั้งหมด" },
            { value: "DRAFT", label: "ฉบับร่าง" },
            { value: "PUBLISHED", label: "เผยแพร่" },
            { value: "ARCHIVED", label: "เก็บถาวร" },
          ]}
        />
      </SearchBar>

      <form action={saveAction} className="space-y-3 rounded-lg border bg-white p-4">
        <HiddenId id={editing?.id} />
        <h3 className="text-base font-semibold text-slate-900">{editing ? "แก้ไขข่าว" : "สร้างข่าว"}</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Input name="title" label="หัวข้อ" defaultValue={editing?.title ?? ""} required />
          <Select
            name="stage"
            label="สถานะ"
            defaultValue={editing?.stage ?? "DRAFT"}
            options={[
              { value: "DRAFT", label: "ฉบับร่าง" },
              { value: "PUBLISHED", label: "เผยแพร่" },
              { value: "ARCHIVED", label: "เก็บถาวร" },
            ]}
          />
          <VisibilitySelect defaultValue={editing?.visibility ?? "PUBLIC"} />
          <label className="mt-6 flex items-center gap-2 text-sm text-slate-700"><input name="isPinned" type="checkbox" defaultChecked={editing?.isPinned ?? false} /> ปักหมุด</label>
        </div>
        <Textarea name="summary" label="สรุป" rows={2} defaultValue={editing?.summary ?? ""} />
        <Textarea name="content" label="เนื้อหา" rows={6} defaultValue={editing?.content ?? ""} required />
        <SuperAdminNewsImageField initialUrls={Array.isArray(editing?.imageUrls) ? editing.imageUrls.map(String) : []} initialCoverUrl={editing?.coverUrl} />
        <ReasonField />
        <Button type="submit">{editing ? "บันทึกการแก้ไข" : "สร้างข่าว"}</Button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="border-b px-4 py-3 text-sm text-slate-600">ทั้งหมด {total} รายการ</div>
        {rows.length === 0 ? <EmptyState text="ยังไม่มีข่าวตามเงื่อนไขนี้" /> : (
          <div className="divide-y">
            {rows.map((item) => (
              <div key={item.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{item.title}</h3>
                    <p className="text-sm text-slate-600">{item.summary || "-"}</p>
                    <p className="mt-1 text-xs text-slate-500">สถานะ {item.stage} · {item.visibility} · ผู้เขียน/แก้ไขล่าสุด {item.author?.name ?? "-"} · เผยแพร่ {formatDate(item.publishedAt)} · แก้ไข {formatDate(item.updatedAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link className="rounded-md border px-3 py-2 text-sm" href={`/superadmin/villages/${villageId}/news?edit=${item.id}`}>แก้ไข</Link>
                    <Link className="rounded-md border px-3 py-2 text-sm" href={`/superadmin/villages/${villageId}/news/${item.id}`}>Preview</Link>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-4">
                  {["PUBLISHED", "DRAFT", "ARCHIVED"].map((target) => (
                    <form key={target} action={stageAction} className="space-y-2">
                      <input type="hidden" name="resourceId" value={item.id} />
                      <input type="hidden" name="stage" value={target} />
                      <Input name="supportReason" aria-label="เหตุผล" placeholder="เหตุผล" required minLength={5} maxLength={500} />
                      <Button className="w-full" type="submit" variant="outline">{target === "PUBLISHED" ? "Publish" : target === "DRAFT" ? "Unpublish" : "Archive"}</Button>
                    </form>
                  ))}
                  <form action={deleteAction} className="space-y-2">
                    <input type="hidden" name="resourceId" value={item.id} />
                    <Input name="supportReason" aria-label="เหตุผล" placeholder="เหตุผล" required minLength={5} maxLength={500} />
                    <Button className="w-full" type="submit" variant="danger">Delete</Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Pager basePath={`/superadmin/villages/${villageId}/news`} page={page} hasNext={page * TAKE < total} />
    </div>
  );
}

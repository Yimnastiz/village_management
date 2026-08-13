import Link from "next/link";
import { VillagePlaceCategory } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { VILLAGE_PLACE_CATEGORY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { EmptyState, formatDate, HiddenId, PageHeader, Pager, ReasonField, SearchBar, SupportNotice } from "../public-content-ui";
import { superAdminDeletePlaceAction, superAdminSavePlaceAction } from "../public-content-actions";

const TAKE = 10;

export default async function SuperAdminVillagePlacesPage({
  params,
  searchParams,
}: {
  params: Promise<{ villageId: string }>;
  searchParams: Promise<{ q?: string; category?: string; page?: string; edit?: string }>;
}) {
  const { villageId } = await params;
  const query = await searchParams;
  const page = Math.max(Number(query.page ?? "1") || 1, 1);
  const search = query.q?.trim() ?? "";
  const category = query.category?.trim() ?? "";
  const where = {
    villageId,
    ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { description: { contains: search, mode: "insensitive" as const } }, { address: { contains: search, mode: "insensitive" as const } }] } : {}),
    ...(category && category !== "ALL" ? { category: category as VillagePlaceCategory } : {}),
  };
  const [village, rows, total, editing] = await Promise.all([
    prisma.village.findUnique({ where: { id: villageId }, select: { name: true } }),
    prisma.villagePlace.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * TAKE, take: TAKE }),
    prisma.villagePlace.count({ where }),
    query.edit ? prisma.villagePlace.findFirst({ where: { id: query.edit, villageId } }) : null,
  ]);
  const saveAction = superAdminSavePlaceAction.bind(null, villageId);
  const deleteAction = superAdminDeletePlaceAction.bind(null, villageId);

  return (
    <div className="space-y-4">
      <PageHeader title="สถานที่" description="จัดการสถานที่ รูปภาพ พิกัด และการมองเห็นของหมู่บ้าน" villageId={villageId} module="places" />
      <SupportNotice villageName={village?.name ?? "-"} />
      <SearchBar action={`/superadmin/villages/${villageId}/places`} search={search}>
        <Select name="category" label="ประเภท" defaultValue={category || "ALL"} options={[{ value: "ALL", label: "ทั้งหมด" }, ...Object.entries(VILLAGE_PLACE_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))]} />
      </SearchBar>

      <form action={saveAction} className="space-y-3 rounded-lg border bg-white p-4">
        <HiddenId id={editing?.id} />
        <h3 className="font-semibold text-slate-900">{editing ? "แก้ไขสถานที่" : "สร้างสถานที่"}</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <Input name="name" label="ชื่อสถานที่" defaultValue={editing?.name ?? ""} required />
          <Select name="category" label="ประเภท" defaultValue={editing?.category ?? "OTHER"} options={Object.entries(VILLAGE_PLACE_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} />
          <Input name="contactPhone" label="เบอร์โทร" defaultValue={editing?.contactPhone ?? ""} />
          <Input name="address" label="ที่อยู่" defaultValue={editing?.address ?? ""} />
          <Input name="openingHours" label="เวลาเปิด-ปิด" defaultValue={editing?.openingHours ?? ""} />
          <Input name="mapUrl" label="ลิงก์แผนที่" defaultValue={editing?.mapUrl ?? ""} />
          <Input name="latitude" label="Latitude" defaultValue={editing?.latitude?.toString() ?? ""} />
          <Input name="longitude" label="Longitude" defaultValue={editing?.longitude?.toString() ?? ""} />
          <label className="mt-6 flex items-center gap-2 text-sm text-slate-700"><input name="isPublic" type="checkbox" defaultChecked={editing?.isPublic ?? true} /> แสดงผลสาธารณะ</label>
        </div>
        <Textarea name="description" label="ที่อยู่/คำอธิบาย" rows={3} defaultValue={editing?.description ?? ""} />
        <Textarea name="imageUrls" label="รูปภาพ (URL หรือ data URL แยกบรรทัด)" rows={2} defaultValue={Array.isArray(editing?.imageUrls) ? editing.imageUrls.map(String).join("\n") : ""} />
        <ReasonField />
        <Button type="submit">{editing ? "บันทึกการแก้ไข" : "สร้างสถานที่"}</Button>
      </form>

      <div className="rounded-lg border bg-white">
        <div className="border-b px-4 py-3 text-sm text-slate-600">ทั้งหมด {total} รายการ</div>
        {rows.length === 0 ? <EmptyState text="ยังไม่มีสถานที่ตามเงื่อนไขนี้" /> : rows.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-b-0">
            <div className="flex gap-3">
              {Array.isArray(item.imageUrls) && item.imageUrls[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={String(item.imageUrls[0])} alt="" className="h-16 w-20 rounded object-cover" />
              ) : <div className="h-16 w-20 rounded bg-slate-100" />}
              <div>
                <h3 className="font-semibold">{item.name}</h3>
                <p className="text-sm text-slate-600">{item.category} · {item.address ?? item.description ?? "-"}</p>
                <p className="text-xs text-slate-500">พิกัด {item.latitude ?? "-"}, {item.longitude ?? "-"} · visibility {item.isPublic ? "PUBLIC" : "RESIDENT"} · แก้ไข {formatDate(item.updatedAt)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link className="rounded-md border px-3 py-2 text-sm" href={`/superadmin/villages/${villageId}/places?edit=${item.id}`}>แก้ไข</Link>
              <form action={deleteAction} className="flex gap-2">
                <input type="hidden" name="resourceId" value={item.id} />
                <Input name="supportReason" aria-label="เหตุผล" placeholder="เหตุผล" required minLength={10} maxLength={500} />
                <Button type="submit" variant="danger">Delete</Button>
              </form>
            </div>
          </div>
        ))}
      </div>
      <Pager basePath={`/superadmin/villages/${villageId}/places`} page={page} hasNext={page * TAKE < total} />
    </div>
  );
}

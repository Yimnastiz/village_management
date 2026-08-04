import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FilterBar } from "@/components/ui/filter-bar";

export function SupportNotice({ villageName }: { villageName: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      คุณกำลังดำเนินการแทนผู้ดูแลหมู่บ้าน ‘{villageName}’ การเปลี่ยนแปลงนี้จะถูกบันทึกใน Audit Log
    </div>
  );
}

export function PageHeader({
  title,
  description,
  villageId,
  module,
}: {
  title: string;
  description: string;
  villageId: string;
  module: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="mb-2"><Badge variant="warning">Super Admin Support Mode</Badge></div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      <Link href={`/superadmin/villages/${villageId}/${module}`} className="rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
        ล้างฟอร์ม
      </Link>
    </div>
  );
}

export function SearchBar({
  action,
  search,
  children,
}: {
  action: string;
  search: string;
  children?: React.ReactNode;
}) {
  return (
    <FilterBar activeFilterCount={Number(Boolean(search))}><form action={action} className="flex flex-wrap items-end gap-2">
      <Input className="w-64" name="q" label="ค้นหา" defaultValue={search} placeholder="พิมพ์คำค้น..." />
      {children}
      <Button type="submit" variant="outline">ค้นหา</Button>
    </form></FilterBar>
  );
}

export function ReasonField() {
  return (
    <Textarea
      name="supportReason"
      label="เหตุผลการดำเนินการ"
      rows={2}
      minLength={10}
      maxLength={500}
      required
      placeholder="ระบุเหตุผลอย่างน้อย 10 ตัวอักษร"
    />
  );
}

export function HiddenId({ id }: { id?: string | null }) {
  return id ? <input type="hidden" name="resourceId" value={id} /> : null;
}

export function VisibilitySelect({ name = "visibility", defaultValue = "PUBLIC" }: { name?: string; defaultValue?: string }) {
  return (
    <Select
      name={name}
      label="การมองเห็น"
      defaultValue={defaultValue}
      options={[
        { value: "PUBLIC", label: "สาธารณะ" },
        { value: "RESIDENT_ONLY", label: "เฉพาะลูกบ้าน" },
        { value: "RESIDENT", label: "เฉพาะลูกบ้าน" },
      ]}
    />
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed bg-white p-6 text-center text-sm text-slate-500">{text}</div>;
}

export function Pager({ basePath, page, hasNext }: { basePath: string; page: number; hasNext: boolean }) {
  return (
    <div className="flex items-center justify-end gap-2">
      {page > 1 && <Link className="rounded-md border px-3 py-2 text-sm" href={`${basePath}?page=${page - 1}`}>ก่อนหน้า</Link>}
      {hasNext && <Link className="rounded-md border px-3 py-2 text-sm" href={`${basePath}?page=${page + 1}`}>ถัดไป</Link>}
    </div>
  );
}

export function formatDate(value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

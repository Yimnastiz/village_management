"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createHousesAction } from "@/app/(admin)/admin/population/houses/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

const MAX_BATCH_SIZE = 50;
type DraftHouse = { id: string; houseNumber: string; address: string };
type FieldErrors = Record<string, Partial<Record<"houseNumber" | "address", string>>>;

function makeDraft(): DraftHouse { return { id: crypto.randomUUID(), houseNumber: "", address: "" }; }

export function HouseBatchCreateDialog({ compact = false }: { compact?: boolean }) {
  const dialogId = useId();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DraftHouse[]>([makeDraft()]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  const enteredCount = items.filter((item) => item.houseNumber.trim()).length;
  const resetAndClose = () => { if (pending) return; setOpen(false); setItems([makeDraft()]); setFieldErrors({}); };
  const update = (id: string, field: "houseNumber" | "address", value: string) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
    setFieldErrors((current) => ({ ...current, [id]: { ...current[id], [field]: undefined } }));
  };
  const submit = () => startTransition(async () => {
    const result = await createHousesAction(items.map(({ houseNumber, address }) => ({ houseNumber, address })));
    if (!result.success) {
      if (result.errors) {
        const nextErrors: FieldErrors = {};
        result.errors.forEach((error) => { const item = items[error.index]; if (item) nextErrors[item.id] = { ...nextErrors[item.id], [error.field]: error.message }; });
        setFieldErrors(nextErrors);
      } else if (result.error) toast.error("เพิ่มบ้านไม่สำเร็จ", result.error);
      return;
    }
    toast.success(result.message);
    setOpen(false); setItems([makeDraft()]); setFieldErrors({});
    router.refresh();
  });

  return <>
    <Button type="button" className="min-h-11 gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden="true" /><span>{compact ? "เพิ่มบ้าน" : "เพิ่มบ้าน"}</span></Button>
    <Dialog open={open} onClose={resetAndClose} title="เพิ่มบ้าน" description="เพิ่มบ้านได้ครั้งละหนึ่งหรือหลายรายการ และตรวจสอบข้อมูลก่อนยืนยัน" className="sm:max-w-3xl" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="min-h-11" onClick={resetAndClose} disabled={pending}>ยกเลิก</Button><Button type="button" className="min-h-11" onClick={submit} isLoading={pending} disabled={pending}>{enteredCount > 1 ? `เพิ่มบ้าน ${enteredCount} หลัง` : "เพิ่มบ้าน"}</Button></div>}>
      <div className="space-y-4">
        {items.map((item, index) => <article key={item.id} className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-semibold text-gray-900">บ้านที่ {index + 1}</h3>{items.length > 1 ? <Button type="button" variant="dangerOutline" size="sm" className="min-h-11 gap-1.5" aria-label={`ลบบ้านรายการที่ ${index + 1}`} onClick={() => { setItems((current) => current.filter((candidate) => candidate.id !== item.id)); setFieldErrors((current) => { const next = { ...current }; delete next[item.id]; return next; }); }} disabled={pending}><Trash2 className="h-4 w-4" aria-hidden="true" />ลบ</Button> : null}</div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]">
            <Input id={`${dialogId}-${item.id}-number`} label="บ้านเลขที่" required maxLength={50} placeholder="เช่น 99/1" value={item.houseNumber} onChange={(event) => update(item.id, "houseNumber", event.target.value)} error={fieldErrors[item.id]?.houseNumber} disabled={pending} />
            <Input id={`${dialogId}-${item.id}-address`} label="ที่อยู่เพิ่มเติม" maxLength={300} placeholder="ซอย จุดสังเกต หรือรายละเอียดที่ช่วยระบุตำแหน่งบ้าน" value={item.address} onChange={(event) => update(item.id, "address", event.target.value)} error={fieldErrors[item.id]?.address} disabled={pending} />
          </div>
        </article>)}
        <div><Button type="button" variant="outline" className="min-h-11 gap-2" onClick={() => setItems((current) => current.length < MAX_BATCH_SIZE ? [...current, makeDraft()] : current)} disabled={pending || items.length >= MAX_BATCH_SIZE}><Plus className="h-4 w-4" aria-hidden="true" />เพิ่มอีกหลัง</Button>{items.length >= MAX_BATCH_SIZE ? <p className="mt-2 text-sm text-gray-500">เพิ่มได้สูงสุด 50 หลังต่อครั้ง</p> : null}</div>
      </div>
    </Dialog>
  </>;
}
